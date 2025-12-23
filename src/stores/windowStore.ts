import { create } from 'zustand'
import type { WindowInfo } from '@/types'

interface WindowState {
  windows: Map<string, WindowInfo>
  activeWindow: string | null
  maxWindows: number
}

interface WindowActions {
  createWindow: (type: WindowInfo['type'], data?: any) => Promise<string>
  closeWindow: (windowId: string) => void
  focusWindow: (windowId: string) => void
  updateWindow: (windowId: string, updates: Partial<WindowInfo>) => void
  setActiveWindow: (windowId: string | null) => void
  getWindow: (windowId: string) => WindowInfo | undefined
  getAllWindows: () => WindowInfo[]
}

export const useWindowStore = create<WindowState & WindowActions>((set, get) => ({
  // State
  windows: new Map(),
  activeWindow: null,
  maxWindows: 5, // 最大同时打开窗口数

  // Actions
  createWindow: async (type: WindowInfo['type'], data?: any): Promise<string> => {
    const { windows, maxWindows } = get()

    // 检查窗口数量限制
    if (windows.size >= maxWindows) {
      throw new Error(`最多只能同时打开 ${maxWindows} 个窗口`)
    }

    const windowId = `${type}-${Date.now()}`
    const windowInfo: WindowInfo = {
      id: windowId,
      type,
      title: getWindowTitle(type, data),
      data,
    }

    try {
      // TODO: 调用 Tauri API 创建实际窗口
      console.log('Creating window:', windowInfo)

      const newWindows = new Map(windows)
      newWindows.set(windowId, windowInfo)
      set({ windows: newWindows, activeWindow: windowId })

      return windowId
    } catch (error) {
      console.error('Failed to create window:', error)
      throw error
    }
  },

  closeWindow: (windowId: string) => {
    const { windows, activeWindow } = get()
    const newWindows = new Map(windows)
    newWindows.delete(windowId)

    let newActiveWindow = activeWindow
    if (activeWindow === windowId) {
      // 如果关闭的是当前活跃窗口，选择另一个窗口作为活跃窗口
      const remainingWindows = Array.from(newWindows.keys())
      newActiveWindow = remainingWindows.length > 0 ? remainingWindows[0] : null
    }

    set({ windows: newWindows, activeWindow: newActiveWindow })

    // TODO: 调用 Tauri API 关闭实际窗口
    console.log('Closing window:', windowId)
  },

  focusWindow: (windowId: string) => {
    const { windows } = get()
    if (windows.has(windowId)) {
      set({ activeWindow: windowId })
      // TODO: 调用 Tauri API 聚焦窗口
      console.log('Focusing window:', windowId)
    }
  },

  updateWindow: (windowId: string, updates: Partial<WindowInfo>) => {
    const { windows } = get()
    const window = windows.get(windowId)
    if (window) {
      const newWindows = new Map(windows)
      newWindows.set(windowId, { ...window, ...updates })
      set({ windows: newWindows })
    }
  },

  setActiveWindow: (windowId: string | null) => {
    set({ activeWindow: windowId })
  },

  getWindow: (windowId: string): WindowInfo | undefined => {
    const { windows } = get()
    return windows.get(windowId)
  },

  getAllWindows: (): WindowInfo[] => {
    const { windows } = get()
    return Array.from(windows.values())
  },
}))

// 辅助函数：根据窗口类型和数据生成标题
function getWindowTitle(type: WindowInfo['type'], data?: any): string {
  switch (type) {
    case 'main':
      return '互联网医院 - 工作台'
    case 'consultation':
      return data?.patientName ? `问诊 - ${data.patientName}` : '问诊窗口'
    case 'patient':
      return data?.patientName ? `患者详情 - ${data.patientName}` : '患者管理'
    case 'settings':
      return '设置'
    default:
      return '未知窗口'
  }
}