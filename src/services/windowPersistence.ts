/**
 * 窗口状态持久化服务
 * Window State Persistence Service
 */

import { invoke } from '@tauri-apps/api/core'
import type { WindowInfo, WindowLayout } from '@/types'

export interface WindowPersistenceService {
  // 保存窗口布局
  saveLayout(name: string, windows: WindowInfo[]): Promise<WindowLayout>

  // 加载窗口布局
  loadLayout(layoutId: string): Promise<WindowLayout | null>

  // 获取所有保存的布局
  getAllLayouts(): Promise<WindowLayout[]>

  // 删除布局
  deleteLayout(layoutId: string): Promise<void>

  // 保存窗口状态到本地存储
  saveWindowState(windowId: string, state: Partial<WindowInfo>): Promise<void>

  // 从本地存储恢复窗口状态
  restoreWindowState(windowId: string): Promise<Partial<WindowInfo> | null>

  // 清理过期的窗口状态
  cleanupExpiredStates(): Promise<void>
}

class WindowPersistenceServiceImpl implements WindowPersistenceService {
  private readonly STORAGE_KEY_PREFIX = 'telemedicine-window'
  private readonly LAYOUT_STORAGE_KEY = `${this.STORAGE_KEY_PREFIX}-layouts`
  private readonly WINDOW_STATE_PREFIX = `${this.STORAGE_KEY_PREFIX}-state`
  private readonly STATE_EXPIRY_DAYS = 7 // 窗口状态保存7天

  async saveLayout(name: string, windows: WindowInfo[]): Promise<WindowLayout> {
    const layout: WindowLayout = {
      id: `layout-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      windows: windows.map(window => ({
        type: window.type,
        position: window.position,
        size: window.size,
        data: window.data,
      })),
      createdAt: new Date(),
    }

    try {
      // 获取现有布局
      const existingLayouts = await this.getAllLayouts()

      // 添加新布局
      const updatedLayouts = [...existingLayouts, layout]

      // 保存到本地存储
      localStorage.setItem(
        this.LAYOUT_STORAGE_KEY,
        JSON.stringify(updatedLayouts)
      )

      return layout
    } catch (error) {
      console.error('Failed to save window layout:', error)
      throw error
    }
  }

  async loadLayout(layoutId: string): Promise<WindowLayout | null> {
    try {
      const layouts = await this.getAllLayouts()
      return layouts.find(layout => layout.id === layoutId) || null
    } catch (error) {
      console.error('Failed to load window layout:', error)
      return null
    }
  }

  async getAllLayouts(): Promise<WindowLayout[]> {
    try {
      const stored = localStorage.getItem(this.LAYOUT_STORAGE_KEY)
      if (!stored) {
        return []
      }

      const layouts = JSON.parse(stored) as WindowLayout[]

      // 转换日期字符串为 Date 对象
      return layouts.map(layout => ({
        ...layout,
        createdAt: new Date(layout.createdAt),
      }))
    } catch (error) {
      console.error('Failed to get all layouts:', error)
      return []
    }
  }

  async deleteLayout(layoutId: string): Promise<void> {
    try {
      const layouts = await this.getAllLayouts()
      const filteredLayouts = layouts.filter(layout => layout.id !== layoutId)

      localStorage.setItem(
        this.LAYOUT_STORAGE_KEY,
        JSON.stringify(filteredLayouts)
      )
    } catch (error) {
      console.error('Failed to delete layout:', error)
      throw error
    }
  }

  async saveWindowState(
    windowId: string,
    state: Partial<WindowInfo>
  ): Promise<void> {
    try {
      const stateKey = `${this.WINDOW_STATE_PREFIX}-${windowId}`
      const stateData = {
        ...state,
        savedAt: new Date().toISOString(),
      }

      localStorage.setItem(stateKey, JSON.stringify(stateData))
    } catch (error) {
      console.error('Failed to save window state:', error)
      throw error
    }
  }

  async restoreWindowState(
    windowId: string
  ): Promise<Partial<WindowInfo> | null> {
    try {
      const stateKey = `${this.WINDOW_STATE_PREFIX}-${windowId}`
      const stored = localStorage.getItem(stateKey)

      if (!stored) {
        return null
      }

      const stateData = JSON.parse(stored)

      // 检查状态是否过期
      const savedAt = new Date(stateData.savedAt)
      const now = new Date()
      const daysDiff =
        (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff > this.STATE_EXPIRY_DAYS) {
        // 状态已过期，删除它
        localStorage.removeItem(stateKey)
        return null
      }

      // 移除元数据，返回窗口状态
      const { savedAt: _, ...windowState } = stateData
      return windowState
    } catch (error) {
      console.error('Failed to restore window state:', error)
      return null
    }
  }

  async cleanupExpiredStates(): Promise<void> {
    try {
      const now = new Date()
      const keysToRemove: string[] = []

      // 遍历所有本地存储键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.WINDOW_STATE_PREFIX)) {
          try {
            const stored = localStorage.getItem(key)
            if (stored) {
              const stateData = JSON.parse(stored)
              const savedAt = new Date(stateData.savedAt)
              const daysDiff =
                (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24)

              if (daysDiff > this.STATE_EXPIRY_DAYS) {
                keysToRemove.push(key)
              }
            }
          } catch (error) {
            // 如果解析失败，也删除这个键
            keysToRemove.push(key)
          }
        }
      }

      // 删除过期的状态
      keysToRemove.forEach(key => localStorage.removeItem(key))

      console.log(`Cleaned up ${keysToRemove.length} expired window states`)
    } catch (error) {
      console.error('Failed to cleanup expired states:', error)
    }
  }
}

// 创建单例实例
export const windowPersistenceService = new WindowPersistenceServiceImpl()

// 窗口布局管理 Hook
export const useWindowLayouts = () => {
  const saveLayout = windowPersistenceService.saveLayout.bind(
    windowPersistenceService
  )
  const loadLayout = windowPersistenceService.loadLayout.bind(
    windowPersistenceService
  )
  const getAllLayouts = windowPersistenceService.getAllLayouts.bind(
    windowPersistenceService
  )
  const deleteLayout = windowPersistenceService.deleteLayout.bind(
    windowPersistenceService
  )

  return {
    saveLayout,
    loadLayout,
    getAllLayouts,
    deleteLayout,
  }
}

// 窗口状态管理 Hook
export const useWindowPersistence = () => {
  const saveWindowState = windowPersistenceService.saveWindowState.bind(
    windowPersistenceService
  )
  const restoreWindowState = windowPersistenceService.restoreWindowState.bind(
    windowPersistenceService
  )
  const cleanupExpiredStates =
    windowPersistenceService.cleanupExpiredStates.bind(windowPersistenceService)

  return {
    saveWindowState,
    restoreWindowState,
    cleanupExpiredStates,
  }
}

// 自动清理过期状态（在应用启动时调用）
export const initializeWindowPersistence = async () => {
  try {
    await windowPersistenceService.cleanupExpiredStates()
  } catch (error) {
    console.error('Failed to initialize window persistence:', error)
  }
}
