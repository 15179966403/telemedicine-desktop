// 安全状态管理

import { create } from 'zustand'
import type { SecurityState, AnomalyRecord } from '../types/security'
import { securityService } from '../services/securityService'

interface SecurityStore extends SecurityState {
  // 状态更新方法
  setLocked: (locked: boolean) => void
  setLastActivity: (time: Date) => void
  setAutoLockEnabled: (enabled: boolean) => void
  setAutoLockTimeout: (timeout: number) => void
  setAnomalies: (anomalies: AnomalyRecord[]) => void
  addAnomaly: (anomaly: AnomalyRecord) => void

  // 业务方法
  updateActivity: () => void
  checkAutoLock: (userId: string) => Promise<void>
  startAutoLockMonitor: (userId: string) => void
  stopAutoLockMonitor: () => void
  lockScreen: () => void
  unlockScreen: () => void
  loadAnomalies: (userId: string) => Promise<void>
}

let autoLockInterval: NodeJS.Timeout | null = null

export const useSecurityStore = create<SecurityStore>((set, get) => ({
  // 初始状态
  isLocked: false,
  lastActivity: new Date(),
  autoLockEnabled: true,
  autoLockTimeout: 300, // 5分钟
  anomalies: [],

  // 状态更新方法
  setLocked: locked => set({ isLocked: locked }),
  setLastActivity: time => set({ lastActivity: time }),
  setAutoLockEnabled: enabled => set({ autoLockEnabled: enabled }),
  setAutoLockTimeout: timeout => set({ autoLockTimeout: timeout }),
  setAnomalies: anomalies => set({ anomalies }),
  addAnomaly: anomaly =>
    set(state => ({ anomalies: [...state.anomalies, anomaly] })),

  // 更新活动时间
  updateActivity: () => {
    set({ lastActivity: new Date() })
  },

  // 检查是否需要自动锁屏
  checkAutoLock: async (userId: string) => {
    const { autoLockEnabled, isLocked } = get()
    if (!autoLockEnabled || isLocked) return

    try {
      const shouldLock = await securityService.shouldAutoLock(userId)
      if (shouldLock) {
        get().lockScreen()
      }
    } catch (error) {
      console.error('检查自动锁屏失败:', error)
    }
  },

  // 启动自动锁屏监控
  startAutoLockMonitor: (userId: string) => {
    const { stopAutoLockMonitor } = get()

    // 先停止现有的监控
    stopAutoLockMonitor()

    // 每10秒检查一次
    autoLockInterval = setInterval(() => {
      get().checkAutoLock(userId)
    }, 10000)
  },

  // 停止自动锁屏监控
  stopAutoLockMonitor: () => {
    if (autoLockInterval) {
      clearInterval(autoLockInterval)
      autoLockInterval = null
    }
  },

  // 锁定屏幕
  lockScreen: () => {
    set({ isLocked: true })
    // 触发锁屏事件，可以在这里添加额外的逻辑
    console.log('屏幕已锁定')
  },

  // 解锁屏幕
  unlockScreen: () => {
    set({ isLocked: false, lastActivity: new Date() })
    console.log('屏幕已解锁')
  },

  // 加载异常记录
  loadAnomalies: async (userId: string) => {
    try {
      const anomalies = await securityService.getAnomalyRecords(userId, false)
      set({ anomalies })
    } catch (error) {
      console.error('加载异常记录失败:', error)
    }
  },
}))

// 全局活动监听器
let activityListeners: (() => void)[] = []

export const setupActivityListeners = () => {
  const updateActivity = () => {
    useSecurityStore.getState().updateActivity()
  }

  // 监听用户活动
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart']

  events.forEach(event => {
    window.addEventListener(event, updateActivity)
    activityListeners.push(() => {
      window.removeEventListener(event, updateActivity)
    })
  })
}

export const cleanupActivityListeners = () => {
  activityListeners.forEach(cleanup => cleanup())
  activityListeners = []
}
