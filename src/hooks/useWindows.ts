import { useCallback } from 'react'
import { useWindowStore } from '@/stores'
import { WindowService } from '@/services'
import { useErrorHandler } from '@/utils/errorHandler'
import type { WindowInfo } from '@/types'

export function useWindows() {
  const {
    windows,
    activeWindow,
    maxWindows,
    createWindow: storeCreateWindow,
    closeWindow: storeCloseWindow,
    focusWindow: storeFocusWindow,
    updateWindow,
    setActiveWindow,
    getWindow,
    getAllWindows,
  } = useWindowStore()

  const { handleAsyncError } = useErrorHandler()
  const windowService = WindowService.getInstance()

  // 创建新窗口
  const createWindow = useCallback(
    async (type: WindowInfo['type'], data?: any) => {
      return handleAsyncError(async () => {
        // 检查窗口数量限制
        if (windows.size >= maxWindows) {
          throw new Error(`最多只能同时打开 ${maxWindows} 个窗口`)
        }

        // 检查是否已存在相同类型和数据的窗口
        const existingWindow = Array.from(windows.values()).find(
          w => w.type === type && JSON.stringify(w.data) === JSON.stringify(data)
        )

        if (existingWindow) {
          // 如果窗口已存在，直接聚焦
          await focusWindow(existingWindow.id)
          return existingWindow.id
        }

        // 创建新窗口
        const windowId = await storeCreateWindow(type, data)

        // 调用系统服务创建实际窗口
        await windowService.createWindow(type, data)

        return windowId
      })
    },
    [windows, maxWindows, storeCreateWindow, windowService, handleAsyncError]
  )

  // 关闭窗口
  const closeWindow = useCallback(
    async (windowId: string) => {
      return handleAsyncError(async () => {
        // 调用系统服务关闭窗口
        await windowService.closeWindow(windowId)

        // 更新本地状态
        storeCloseWindow(windowId)
      })
    },
    [windowService, storeCloseWindow, handleAsyncError]
  )

  // 聚焦窗口
  const focusWindow = useCallback(
    async (windowId: string) => {
      return handleAsyncError(async () => {
        // 调用系统服务聚焦窗口
        await windowService.focusWindow(windowId)

        // 更新本地状态
        storeFocusWindow(windowId)
      })
    },
    [windowService, storeFocusWindow, handleAsyncError]
  )

  // 最小化窗口
  const minimizeWindow = useCallback(
    async (windowId: string) => {
      return handleAsyncError(async () => {
        await windowService.minimizeWindow(windowId)
      })
    },
    [windowService, handleAsyncError]
  )

  // 最大化窗口
  const maximizeWindow = useCallback(
    async (windowId: string) => {
      return handleAsyncError(async () => {
        await windowService.maximizeWindow(windowId)
      })
    },
    [windowService, handleAsyncError]
  )

  // 设置窗口标题
  const setWindowTitle = useCallback(
    async (windowId: string, title: string) => {
      return handleAsyncError(async () => {
        await windowService.setWindowTitle(windowId, title)
        updateWindow(windowId, { title })
      })
    },
    [windowService, updateWindow, handleAsyncError]
  )

  // 创建问诊窗口
  const createConsultationWindow = useCallback(
    async (consultationId: string, patientName?: string) => {
      return createWindow('consultation', {
        consultationId,
        patientName,
      })
    },
    [createWindow]
  )

  // 创建患者详情窗口
  const createPatientWindow = useCallback(
    async (patientId: string, patientName?: string) => {
      return createWindow('patient', {
        patientId,
        patientName,
      })
    },
    [createWindow]
  )

  // 创建设置窗口
  const createSettingsWindow = useCallback(async () => {
    return createWindow('settings')
  }, [createWindow])

  // 关闭所有窗口
  const closeAllWindows = useCallback(async () => {
    const windowIds = Array.from(windows.keys())

    // 并行关闭所有窗口
    await Promise.allSettled(
      windowIds.map(windowId => closeWindow(windowId))
    )
  }, [windows, closeWindow])

  // 获取窗口统计信息
  const getWindowStats = useCallback(() => {
    const windowList = getAllWindows()
    const typeCount = windowList.reduce((acc, window) => {
      acc[window.type] = (acc[window.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: windows.size,
      active: activeWindow,
      maxAllowed: maxWindows,
      remaining: maxWindows - windows.size,
      typeCount,
    }
  }, [windows, activeWindow, maxWindows, getAllWindows])

  // 检查是否可以创建新窗口
  const canCreateWindow = useCallback(() => {
    return windows.size < maxWindows
  }, [windows.size, maxWindows])

  // 获取指定类型的所有窗口
  const getWindowsByType = useCallback(
    (type: WindowInfo['type']) => {
      return getAllWindows().filter(window => window.type === type)
    },
    [getAllWindows]
  )

  // 检查指定窗口是否存在
  const hasWindow = useCallback(
    (windowId: string) => {
      return windows.has(windowId)
    },
    [windows]
  )

  // 检查指定类型的窗口是否存在
  const hasWindowOfType = useCallback(
    (type: WindowInfo['type'], data?: any) => {
      return getAllWindows().some(
        window =>
          window.type === type &&
          (!data || JSON.stringify(window.data) === JSON.stringify(data))
      )
    },
    [getAllWindows]
  )

  return {
    // 状态
    windows: getAllWindows(),
    activeWindow,
    windowStats: getWindowStats(),

    // 基础窗口操作
    createWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    setWindowTitle,
    updateWindow,
    setActiveWindow,

    // 特定类型窗口创建
    createConsultationWindow,
    createPatientWindow,
    createSettingsWindow,

    // 批量操作
    closeAllWindows,

    // 查询方法
    getWindow,
    getWindowsByType,
    hasWindow,
    hasWindowOfType,
    canCreateWindow,
  }
}