/**
 * 离线功能状态管理
 * Offline functionality state management
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  offlineService,
  type OfflineDataItem,
  type SyncConflict,
} from '@/services/offlineService'
import {
  networkStatusService,
  type NetworkStatus,
  type NetworkInfo,
} from '@/services/networkStatusService'
import {
  offlineMessageQueue,
  type QueueStats,
} from '@/services/offlineMessageQueue'
import type { OperationResult } from '@/types'

// 离线状态接口
export interface OfflineState {
  // 网络状态
  networkStatus: NetworkStatus
  networkInfo: NetworkInfo

  // 离线队列状态
  queueStats: QueueStats

  // 同步状态
  isSyncing: boolean
  lastSyncTime?: Date
  syncErrors: string[]

  // 冲突管理
  conflicts: SyncConflict[]

  // 缓存统计
  cacheStats: {
    memoryCache: any
    localDatabase: any
    totalSize: number
  }

  // UI 状态
  showOfflineIndicator: boolean
  showSyncProgress: boolean

  // Actions
  initialize: () => Promise<void>
  destroy: () => void

  // 网络状态相关
  checkNetworkStatus: () => Promise<void>

  // 离线队列相关
  addToOfflineQueue: <T>(
    id: string,
    type: OfflineDataItem['type'],
    data: T,
    operation: OfflineDataItem['operation']
  ) => Promise<void>
  processOfflineQueue: () => Promise<void>
  clearOfflineQueue: () => Promise<void>

  // 同步相关
  syncData: () => Promise<void>
  resolveSyncConflict: (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: any
  ) => Promise<void>

  // 缓存相关
  refreshCacheStats: () => Promise<void>
  cleanupExpiredCache: () => Promise<void>

  // UI 相关
  setShowOfflineIndicator: (show: boolean) => void
  setShowSyncProgress: (show: boolean) => void
}

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    networkStatus: 'online',
    networkInfo: {
      status: 'online',
      lastChecked: new Date(),
    },
    queueStats: {
      totalMessages: 0,
      pendingMessages: 0,
      sendingMessages: 0,
      failedMessages: 0,
      sentMessages: 0,
    },
    isSyncing: false,
    syncErrors: [],
    conflicts: [],
    cacheStats: {
      memoryCache: { totalItems: 0, expiredItems: 0, totalSize: 0 },
      localDatabase: { totalItems: 0, totalSize: 0 },
      totalSize: 0,
    },
    showOfflineIndicator: false,
    showSyncProgress: false,

    // 初始化离线功能
    initialize: async () => {
      try {
        console.log('Initializing offline store...')

        // 初始化网络状态服务
        await networkStatusService.initialize()

        // 初始化离线服务
        await offlineService.initialize()

        // 初始化离线消息队列
        await offlineMessageQueue.initialize()

        // 监听网络状态变化
        networkStatusService.addStatusListener((status, info) => {
          set({
            networkStatus: status,
            networkInfo: info,
            showOfflineIndicator: status !== 'online',
          })

          // 网络恢复时自动同步
          if (status === 'online') {
            get().syncData()
          }
        })

        // 获取初始状态
        const networkInfo = networkStatusService.getNetworkInfo()
        const queueStats = offlineMessageQueue.getQueueStats()
        const conflicts = offlineService.getSyncConflicts()
        const cacheStats = await offlineService.getCacheStats()

        set({
          networkStatus: networkInfo.status,
          networkInfo,
          queueStats,
          conflicts,
          cacheStats,
          showOfflineIndicator: networkInfo.status !== 'online',
        })

        console.log('Offline store initialized successfully')
      } catch (error) {
        console.error('Failed to initialize offline store:', error)
        set({
          syncErrors: ['初始化离线功能失败'],
        })
      }
    },

    // 销毁离线功能
    destroy: () => {
      try {
        networkStatusService.destroy()
        offlineService.destroy()
        offlineMessageQueue.destroy()

        set({
          networkStatus: 'online',
          networkInfo: { status: 'online', lastChecked: new Date() },
          queueStats: {
            totalMessages: 0,
            pendingMessages: 0,
            sendingMessages: 0,
            failedMessages: 0,
            sentMessages: 0,
          },
          isSyncing: false,
          syncErrors: [],
          conflicts: [],
          showOfflineIndicator: false,
          showSyncProgress: false,
        })

        console.log('Offline store destroyed')
      } catch (error) {
        console.error('Failed to destroy offline store:', error)
      }
    },

    // 检查网络状态
    checkNetworkStatus: async () => {
      try {
        const networkInfo = await networkStatusService.checkNetworkStatus()
        set({
          networkStatus: networkInfo.status,
          networkInfo,
          showOfflineIndicator: networkInfo.status !== 'online',
        })
      } catch (error) {
        console.error('Failed to check network status:', error)
      }
    },

    // 添加到离线队列
    addToOfflineQueue: async <T>(
      id: string,
      type: OfflineDataItem['type'],
      data: T,
      operation: OfflineDataItem['operation']
    ) => {
      try {
        await offlineService.addToOfflineQueue(id, type, data, operation)

        // 更新队列统计
        const queueStats = offlineMessageQueue.getQueueStats()
        set({ queueStats })

        console.log(`Added to offline queue: ${id} (${type}:${operation})`)
      } catch (error) {
        console.error('Failed to add to offline queue:', error)
        set({
          syncErrors: [...get().syncErrors, '添加离线操作失败'],
        })
      }
    },

    // 处理离线队列
    processOfflineQueue: async () => {
      const state = get()
      if (state.isSyncing) {
        console.log('Already syncing, skipping queue processing')
        return
      }

      try {
        set({ isSyncing: true, showSyncProgress: true, syncErrors: [] })

        // 处理离线数据队列
        const dataResults = await offlineService.processOfflineQueue()

        // 处理离线消息队列
        await offlineMessageQueue.processQueue()

        // 更新状态
        const queueStats = offlineMessageQueue.getQueueStats()
        const conflicts = offlineService.getSyncConflicts()
        const cacheStats = await offlineService.getCacheStats()

        const errors: string[] = []
        dataResults.forEach(result => {
          if (!result.success && result.error) {
            errors.push(result.error.message)
          }
        })

        set({
          queueStats,
          conflicts,
          cacheStats,
          syncErrors: errors,
          lastSyncTime: new Date(),
        })

        console.log('Offline queue processed successfully')
      } catch (error) {
        console.error('Failed to process offline queue:', error)
        set({
          syncErrors: [...get().syncErrors, '处理离线队列失败'],
        })
      } finally {
        set({ isSyncing: false, showSyncProgress: false })
      }
    },

    // 清空离线队列
    clearOfflineQueue: async () => {
      try {
        await offlineMessageQueue.clearQueue()

        const queueStats = offlineMessageQueue.getQueueStats()
        set({ queueStats })

        console.log('Offline queue cleared')
      } catch (error) {
        console.error('Failed to clear offline queue:', error)
        set({
          syncErrors: [...get().syncErrors, '清空离线队列失败'],
        })
      }
    },

    // 同步数据
    syncData: async () => {
      const state = get()
      if (state.isSyncing) {
        console.log('Already syncing')
        return
      }

      if (state.networkStatus === 'offline') {
        console.log('Network is offline, cannot sync')
        return
      }

      try {
        set({ isSyncing: true, showSyncProgress: true, syncErrors: [] })

        // 处理离线队列
        await get().processOfflineQueue()

        console.log('Data sync completed')
      } catch (error) {
        console.error('Failed to sync data:', error)
        set({
          syncErrors: [...get().syncErrors, '数据同步失败'],
        })
      } finally {
        set({ isSyncing: false, showSyncProgress: false })
      }
    },

    // 解决同步冲突
    resolveSyncConflict: async (
      conflictId: string,
      resolution: 'local' | 'remote' | 'merge',
      mergedData?: any
    ) => {
      try {
        const result = await offlineService.resolveSyncConflict(
          conflictId,
          resolution,
          mergedData
        )

        if (result.success) {
          // 更新冲突列表
          const conflicts = offlineService.getSyncConflicts()
          set({ conflicts })

          console.log(`Sync conflict resolved: ${conflictId} (${resolution})`)
        } else {
          throw new Error(result.error?.message || '解决冲突失败')
        }
      } catch (error) {
        console.error('Failed to resolve sync conflict:', error)
        set({
          syncErrors: [...get().syncErrors, '解决同步冲突失败'],
        })
      }
    },

    // 刷新缓存统计
    refreshCacheStats: async () => {
      try {
        const cacheStats = await offlineService.getCacheStats()
        set({ cacheStats })
      } catch (error) {
        console.error('Failed to refresh cache stats:', error)
      }
    },

    // 清理过期缓存
    cleanupExpiredCache: async () => {
      try {
        await offlineService.cleanupExpiredCache()

        // 刷新缓存统计
        const cacheStats = await offlineService.getCacheStats()
        set({ cacheStats })

        console.log('Expired cache cleaned up')
      } catch (error) {
        console.error('Failed to cleanup expired cache:', error)
        set({
          syncErrors: [...get().syncErrors, '清理过期缓存失败'],
        })
      }
    },

    // 设置离线指示器显示状态
    setShowOfflineIndicator: (show: boolean) => {
      set({ showOfflineIndicator: show })
    },

    // 设置同步进度显示状态
    setShowSyncProgress: (show: boolean) => {
      set({ showSyncProgress: show })
    },
  }))
)

// 订阅网络状态变化，自动更新 UI
useOfflineStore.subscribe(
  state => state.networkStatus,
  networkStatus => {
    console.log(`Network status changed in store: ${networkStatus}`)
  }
)

// 订阅队列状态变化
useOfflineStore.subscribe(
  state => state.queueStats,
  queueStats => {
    console.log('Queue stats updated:', queueStats)
  }
)
