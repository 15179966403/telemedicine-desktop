import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'
import type {
  WindowInfo,
  WindowDisplayState,
  ResourceUsage,
  WindowConfig,
} from '@/types'
import {
  windowCommunicationService,
  MESSAGE_TYPES,
} from '@/services/windowCommunication'

interface WindowState {
  windows: Map<string, WindowInfo>
  activeWindow: string | null
  maxWindows: number
  resourceUsage: ResourceUsage | null
  loading: boolean
  error: string | null
}

interface WindowActions {
  createWindow: (config: WindowConfig) => Promise<string>
  closeWindow: (windowId: string) => Promise<void>
  focusWindow: (windowId: string) => Promise<void>
  minimizeWindow: (windowId: string) => Promise<void>
  maximizeWindow: (windowId: string) => Promise<void>
  updateWindow: (windowId: string, updates: Partial<WindowInfo>) => void
  setActiveWindow: (windowId: string | null) => void
  getWindow: (windowId: string) => WindowInfo | undefined
  getAllWindows: () => Promise<WindowInfo[]>
  getResourceUsage: () => Promise<ResourceUsage>
  checkLimits: () => Promise<boolean>
  refreshWindows: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// 持久化配置
const persistConfig = {
  name: 'window-store',
  partialize: (state: WindowState & WindowActions) => ({
    maxWindows: state.maxWindows,
    // 不持久化 windows Map，因为窗口状态应该从 Tauri 获取
  }),
}

export const useWindowStore = create<WindowState & WindowActions>()(
  persist(
    (set, get) => ({
      // State
      windows: new Map(),
      activeWindow: null,
      maxWindows: 8, // 最大同时打开窗口数
      resourceUsage: null,
      loading: false,
      error: null,

      // Actions
      createWindow: async (config: WindowConfig): Promise<string> => {
        const { checkLimits, setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          // 检查窗口数量限制
          const canCreate = await checkLimits()
          if (!canCreate) {
            throw new Error('已达到最大窗口数量限制')
          }

          // 调用 Tauri API 创建窗口
          const windowId = await invoke<string>('create_new_window', {
            request: {
              window_type: config.type,
              data: config.data || {},
              position:
                config.width && config.height
                  ? {
                      x: 100,
                      y: 100,
                    }
                  : null,
              size:
                config.width && config.height
                  ? {
                      width: config.width,
                      height: config.height,
                    }
                  : null,
            },
          })

          // 刷新窗口列表
          await get().refreshWindows()

          // 通知其他窗口
          await windowCommunicationService.broadcastMessage(
            MESSAGE_TYPES.WINDOW_FOCUS_REQUEST,
            {
              windowId,
              action: 'created',
            }
          )

          return windowId
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '创建窗口失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      closeWindow: async (windowId: string): Promise<void> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          // 调用 Tauri API 关闭窗口
          await invoke('close_window_by_id', { windowId })

          // 从本地状态中移除窗口
          const { windows, activeWindow } = get()
          const newWindows = new Map(windows)
          newWindows.delete(windowId)

          let newActiveWindow = activeWindow
          if (activeWindow === windowId) {
            // 如果关闭的是当前活跃窗口，选择另一个窗口作为活跃窗口
            const remainingWindows = Array.from(newWindows.keys())
            newActiveWindow =
              remainingWindows.length > 0 ? remainingWindows[0] : null
          }

          set({ windows: newWindows, activeWindow: newActiveWindow })

          // 通知其他窗口
          await windowCommunicationService.broadcastMessage(
            MESSAGE_TYPES.WINDOW_CLOSE_REQUEST,
            {
              windowId,
              action: 'closed',
            }
          )
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '关闭窗口失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      focusWindow: async (windowId: string): Promise<void> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          // 调用 Tauri API 聚焦窗口
          await invoke('focus_window_by_id', { windowId })

          // 更新本地状态
          set({ activeWindow: windowId })

          // 通知其他窗口
          await windowCommunicationService.broadcastMessage(
            MESSAGE_TYPES.WINDOW_FOCUS_REQUEST,
            {
              windowId,
              action: 'focused',
            }
          )
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '聚焦窗口失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      minimizeWindow: async (windowId: string): Promise<void> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          await invoke('minimize_window', { windowId })

          // 更新本地窗口状态
          const { windows } = get()
          const window = windows.get(windowId)
          if (window) {
            const newWindows = new Map(windows)
            newWindows.set(windowId, { ...window, state: 'minimized' })
            set({ windows: newWindows })
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '最小化窗口失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      maximizeWindow: async (windowId: string): Promise<void> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          await invoke('maximize_window', { windowId })

          // 更新本地窗口状态
          const { windows } = get()
          const window = windows.get(windowId)
          if (window) {
            const newWindows = new Map(windows)
            newWindows.set(windowId, { ...window, state: 'maximized' })
            set({ windows: newWindows })
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '最大化窗口失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
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

      getAllWindows: async (): Promise<WindowInfo[]> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          const windowList = await invoke<WindowInfo[]>('get_all_windows')

          // 更新本地状态
          const newWindows = new Map<string, WindowInfo>()
          windowList.forEach(window => {
            newWindows.set(window.id, window)
          })

          set({ windows: newWindows })
          return windowList
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '获取窗口列表失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      getResourceUsage: async (): Promise<ResourceUsage> => {
        const { setLoading, setError } = get()

        setLoading(true)
        setError(null)

        try {
          const usage = await invoke<ResourceUsage>('get_resource_usage')
          set({ resourceUsage: usage })
          return usage
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '获取资源使用情况失败'
          setError(errorMessage)
          throw error
        } finally {
          setLoading(false)
        }
      },

      checkLimits: async (): Promise<boolean> => {
        try {
          return await invoke<boolean>('check_window_limits')
        } catch (error) {
          console.error('Failed to check window limits:', error)
          return false
        }
      },

      refreshWindows: async (): Promise<void> => {
        try {
          await get().getAllWindows()
          await get().getResourceUsage()
        } catch (error) {
          console.error('Failed to refresh windows:', error)
        }
      },

      setLoading: (loading: boolean) => {
        set({ loading })
      },

      setError: (error: string | null) => {
        set({ error })
      },
    }),
    persistConfig
  )
)

// 辅助函数：根据窗口类型和数据生成标题
function getWindowTitle(type: WindowInfo['type'], data?: any): string {
  switch (type) {
    case 'main':
      return '互联网医院 - 工作台'
    case 'consultation':
      return data?.patientName ? `问诊 - ${data.patientName}` : '问诊窗口'
    case 'patient_detail':
      return data?.patientName ? `患者详情 - ${data.patientName}` : '患者管理'
    case 'settings':
      return '设置'
    default:
      return '未知窗口'
  }
}

// 辅助函数：根据窗口类型和数据生成URL
function getWindowUrl(type: WindowInfo['type'], data?: any): string {
  switch (type) {
    case 'main':
      return '/'
    case 'consultation':
      return data?.consultationId
        ? `/consultation/${data.consultationId}`
        : '/consultation'
    case 'patient_detail':
      return data?.patientId ? `/patient/${data.patientId}` : '/patient'
    case 'settings':
      return '/settings'
    default:
      return '/'
  }
}
