/**
 * 窗口管理系统测试
 * Window Management System Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWindowStore } from '@/stores/windowStore'
import { windowResourceManager } from '@/services/windowResourceManager'
import { windowPersistenceService } from '@/services/windowPersistence'
import { windowCommunicationService } from '@/services/windowCommunication'
import type { WindowInfo, WindowConfig, ResourceUsage } from '@/types'

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Mock Tauri events
const mockListen = vi.fn()
const mockEmit = vi.fn()
vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
}))

describe('窗口管理系统测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // 设置默认的 mock 返回值
    mockInvoke.mockImplementation((command: string) => {
      switch (command) {
        case 'get_all_windows':
          return Promise.resolve([])
        case 'get_resource_usage':
          return Promise.resolve({
            memoryUsage: 100,
            windowCount: 0,
            consultationWindowCount: 0,
            lastUpdated: new Date(),
          })
        case 'check_window_limits':
          return Promise.resolve(true)
        default:
          return Promise.resolve()
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('窗口存储 (Window Store)', () => {
    it('应该能够创建新窗口', async () => {
      const { result } = renderHook(() => useWindowStore())

      const windowConfig: WindowConfig = {
        type: 'consultation',
        title: '问诊窗口',
        url: '/consultation/123',
        data: { consultationId: '123', patientName: '张三' },
        width: 800,
        height: 600,
      }

      mockInvoke.mockResolvedValueOnce('consultation-123456')

      await act(async () => {
        const windowId = await result.current.createWindow(windowConfig)
        expect(windowId).toBe('consultation-123456')
      })

      expect(mockInvoke).toHaveBeenCalledWith('create_new_window', {
        request: {
          window_type: 'consultation',
          data: { consultationId: '123', patientName: '张三' },
          position: { x: 100, y: 100 },
          size: { width: 800, height: 600 },
        },
      })
    })

    it('应该能够关闭窗口', async () => {
      const { result } = renderHook(() => useWindowStore())

      await act(async () => {
        await result.current.closeWindow('test-window-id')
      })

      expect(mockInvoke).toHaveBeenCalledWith('close_window_by_id', {
        windowId: 'test-window-id',
      })
    })

    it('应该能够聚焦窗口', async () => {
      const { result } = renderHook(() => useWindowStore())

      await act(async () => {
        await result.current.focusWindow('test-window-id')
      })

      expect(mockInvoke).toHaveBeenCalledWith('focus_window_by_id', {
        windowId: 'test-window-id',
      })
    })

    it('应该能够获取所有窗口', async () => {
      const mockWindows: WindowInfo[] = [
        {
          id: 'window-1',
          type: 'main',
          title: '工作台',
          url: '/',
          data: {},
          position: { x: 0, y: 0 },
          size: { width: 1200, height: 800 },
          state: 'normal',
          createdAt: new Date(),
          lastFocused: new Date(),
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockWindows)

      const { result } = renderHook(() => useWindowStore())

      let windows: WindowInfo[] = []
      await act(async () => {
        windows = await result.current.getAllWindows()
      })

      expect(windows).toEqual(mockWindows)
      expect(mockInvoke).toHaveBeenCalledWith('get_all_windows')
    })

    it('应该能够检查窗口限制', async () => {
      const { result } = renderHook(() => useWindowStore())

      let canCreate = false
      await act(async () => {
        canCreate = await result.current.checkLimits()
      })

      expect(canCreate).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('check_window_limits')
    })
  })

  describe('窗口资源管理 (Resource Manager)', () => {
    it('应该能够检查资源使用情况', async () => {
      const mockUsage: ResourceUsage = {
        memoryUsage: 256,
        windowCount: 3,
        consultationWindowCount: 1,
        lastUpdated: new Date(),
      }

      mockInvoke.mockResolvedValueOnce(mockUsage)

      const usage = await windowResourceManager.checkResourceUsage()

      expect(usage).toEqual(mockUsage)
      expect(mockInvoke).toHaveBeenCalledWith('get_resource_usage')
    })

    it('应该能够检查是否可以创建窗口', async () => {
      const mockUsage: ResourceUsage = {
        memoryUsage: 100,
        windowCount: 2,
        consultationWindowCount: 1,
        lastUpdated: new Date(),
      }

      mockInvoke
        .mockResolvedValueOnce(mockUsage) // checkResourceUsage
        .mockResolvedValueOnce({
          // getWindowLimits (from localStorage)
          maxWindows: 8,
          maxConsultationWindows: 5,
          memoryThreshold: 512,
          cpuThreshold: 80,
        })

      const canCreate =
        await windowResourceManager.canCreateWindow('consultation')

      expect(canCreate).toBe(true)
    })

    it('应该在达到限制时拒绝创建窗口', async () => {
      const mockUsage: ResourceUsage = {
        memoryUsage: 600, // 超过512MB限制
        windowCount: 8, // 达到最大窗口数
        consultationWindowCount: 5, // 达到最大问诊窗口数
        lastUpdated: new Date(),
      }

      mockInvoke.mockResolvedValueOnce(mockUsage)

      const canCreate =
        await windowResourceManager.canCreateWindow('consultation')

      expect(canCreate).toBe(false)
    })

    it('应该能够更新窗口限制', async () => {
      const newLimits = {
        maxWindows: 10,
        maxConsultationWindows: 6,
      }

      await windowResourceManager.updateWindowLimits(newLimits)

      const stored = localStorage.getItem('window-limits')
      expect(stored).toBeTruthy()

      const parsedLimits = JSON.parse(stored!)
      expect(parsedLimits.maxWindows).toBe(10)
      expect(parsedLimits.maxConsultationWindows).toBe(6)
    })

    it('应该拒绝无效的窗口限制', async () => {
      const invalidLimits = {
        maxWindows: 0, // 无效值
      }

      await expect(
        windowResourceManager.updateWindowLimits(invalidLimits)
      ).rejects.toThrow('最大窗口数量必须在1-20之间')
    })
  })

  describe('窗口状态持久化 (Persistence)', () => {
    it('应该能够保存窗口布局', async () => {
      const mockWindows: WindowInfo[] = [
        {
          id: 'window-1',
          type: 'main',
          title: '工作台',
          url: '/',
          data: {},
          position: { x: 0, y: 0 },
          size: { width: 1200, height: 800 },
          state: 'normal',
          createdAt: new Date(),
          lastFocused: new Date(),
        },
      ]

      const layout = await windowPersistenceService.saveLayout(
        '测试布局',
        mockWindows
      )

      expect(layout.name).toBe('测试布局')
      expect(layout.windows).toHaveLength(1)
      expect(layout.windows[0].type).toBe('main')

      // 检查是否保存到 localStorage
      const stored = localStorage.getItem('telemedicine-window-layouts')
      expect(stored).toBeTruthy()

      const layouts = JSON.parse(stored!)
      expect(layouts).toHaveLength(1)
      expect(layouts[0].name).toBe('测试布局')
    })

    it('应该能够加载窗口布局', async () => {
      // 先保存一个布局
      const mockWindows: WindowInfo[] = [
        {
          id: 'window-1',
          type: 'consultation',
          title: '问诊窗口',
          url: '/consultation/123',
          data: { consultationId: '123' },
          position: { x: 100, y: 100 },
          size: { width: 800, height: 600 },
          state: 'normal',
          createdAt: new Date(),
          lastFocused: new Date(),
        },
      ]

      const savedLayout = await windowPersistenceService.saveLayout(
        '问诊布局',
        mockWindows
      )

      // 加载布局
      const loadedLayout = await windowPersistenceService.loadLayout(
        savedLayout.id
      )

      expect(loadedLayout).toBeTruthy()
      expect(loadedLayout!.name).toBe('问诊布局')
      expect(loadedLayout!.windows).toHaveLength(1)
      expect(loadedLayout!.windows[0].type).toBe('consultation')
    })

    it('应该能够删除窗口布局', async () => {
      // 先保存一个布局
      const mockWindows: WindowInfo[] = []
      const savedLayout = await windowPersistenceService.saveLayout(
        '待删除布局',
        mockWindows
      )

      // 删除布局
      await windowPersistenceService.deleteLayout(savedLayout.id)

      // 尝试加载已删除的布局
      const loadedLayout = await windowPersistenceService.loadLayout(
        savedLayout.id
      )
      expect(loadedLayout).toBeNull()
    })

    it('应该能够保存和恢复窗口状态', async () => {
      const windowState = {
        position: { x: 200, y: 150 },
        size: { width: 900, height: 700 },
        state: 'maximized' as const,
      }

      // 保存窗口状态
      await windowPersistenceService.saveWindowState('test-window', windowState)

      // 恢复窗口状态
      const restoredState =
        await windowPersistenceService.restoreWindowState('test-window')

      expect(restoredState).toBeTruthy()
      expect(restoredState!.position).toEqual({ x: 200, y: 150 })
      expect(restoredState!.size).toEqual({ width: 900, height: 700 })
      expect(restoredState!.state).toBe('maximized')
    })

    it('应该清理过期的窗口状态', async () => {
      // 手动创建一个过期的状态
      const expiredState = {
        position: { x: 100, y: 100 },
        savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8天前
      }

      localStorage.setItem(
        'telemedicine-window-state-expired-window',
        JSON.stringify(expiredState)
      )

      // 清理过期状态
      await windowPersistenceService.cleanupExpiredStates()

      // 检查过期状态是否被删除
      const stored = localStorage.getItem(
        'telemedicine-window-state-expired-window'
      )
      expect(stored).toBeNull()
    })
  })

  describe('窗口间通信 (Communication)', () => {
    it('应该能够发送消息到指定窗口', async () => {
      await windowCommunicationService.sendMessage(
        'target-window',
        'test-message',
        { data: 'test' }
      )

      expect(mockEmit).toHaveBeenCalledWith('window-message', {
        type: 'test-message',
        payload: { data: 'test' },
        sourceWindowId: expect.any(String),
        targetWindowId: 'target-window',
        timestamp: expect.any(Date),
      })
    })

    it('应该能够广播消息到所有窗口', async () => {
      await windowCommunicationService.broadcastMessage('broadcast-message', {
        data: 'broadcast',
      })

      expect(mockEmit).toHaveBeenCalledWith('window-broadcast', {
        type: 'broadcast-message',
        payload: { data: 'broadcast' },
        sourceWindowId: expect.any(String),
        timestamp: expect.any(Date),
      })
    })

    it('应该能够监听消息', async () => {
      const mockCallback = vi.fn()

      // 模拟监听器设置
      mockListen.mockImplementation((event, callback) => {
        if (event === 'window-message') {
          // 模拟接收到消息
          setTimeout(() => {
            callback({
              payload: {
                type: 'test-message',
                payload: { data: 'test' },
                sourceWindowId: 'source-window',
                targetWindowId: 'current-window',
                timestamp: new Date(),
              },
            })
          }, 0)
        }
        return Promise.resolve(() => {})
      })

      await windowCommunicationService.onMessage(mockCallback)

      // 等待异步消息处理
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockCallback).toHaveBeenCalledWith({
        type: 'test-message',
        payload: { data: 'test' },
        sourceWindowId: 'source-window',
        targetWindowId: 'current-window',
        timestamp: expect.any(Date),
      })
    })
  })

  describe('集成测试 (Integration Tests)', () => {
    it('应该能够完整地创建、管理和关闭窗口', async () => {
      const { result } = renderHook(() => useWindowStore())

      // 模拟创建窗口的返回值
      mockInvoke
        .mockResolvedValueOnce('consultation-123') // create_new_window
        .mockResolvedValueOnce([
          {
            // get_all_windows (refreshWindows)
            id: 'consultation-123',
            type: 'consultation',
            title: '问诊 - 张三',
            url: '/consultation/123',
            data: { consultationId: '123', patientName: '张三' },
            position: { x: 100, y: 100 },
            size: { width: 800, height: 600 },
            state: 'normal',
            createdAt: new Date(),
            lastFocused: new Date(),
          },
        ])
        .mockResolvedValueOnce({
          // get_resource_usage (refreshWindows)
          memoryUsage: 150,
          windowCount: 1,
          consultationWindowCount: 1,
          lastUpdated: new Date(),
        })
        .mockResolvedValueOnce(undefined) // focus_window_by_id
        .mockResolvedValueOnce(undefined) // close_window_by_id

      // 1. 创建窗口
      let windowId: string = ''
      await act(async () => {
        windowId = await result.current.createWindow({
          type: 'consultation',
          title: '问诊 - 张三',
          url: '/consultation/123',
          data: { consultationId: '123', patientName: '张三' },
        })
      })

      expect(windowId).toBe('consultation-123')

      // 2. 聚焦窗口
      await act(async () => {
        await result.current.focusWindow(windowId)
      })

      expect(mockInvoke).toHaveBeenCalledWith('focus_window_by_id', {
        windowId: 'consultation-123',
      })

      // 3. 关闭窗口
      await act(async () => {
        await result.current.closeWindow(windowId)
      })

      expect(mockInvoke).toHaveBeenCalledWith('close_window_by_id', {
        windowId: 'consultation-123',
      })
    })

    it('应该在资源不足时自动管理窗口', async () => {
      // 模拟高资源使用情况
      const highUsage: ResourceUsage = {
        memoryUsage: 500, // 接近512MB限制
        windowCount: 7, // 接近8个窗口限制
        consultationWindowCount: 4,
        lastUpdated: new Date(),
      }

      mockInvoke
        .mockResolvedValueOnce(highUsage) // checkResourceUsage
        .mockResolvedValueOnce([
          {
            // get_all_windows (for forceCloseOldestWindow)
            id: 'old-window',
            type: 'settings',
            title: '设置',
            url: '/settings',
            data: {},
            position: { x: 0, y: 0 },
            size: { width: 600, height: 500 },
            state: 'normal',
            createdAt: new Date(Date.now() - 60000), // 1分钟前创建
            lastFocused: new Date(Date.now() - 30000), // 30秒前聚焦
          },
        ])
        .mockResolvedValueOnce(undefined) // close_window_by_id

      const canCreate =
        await windowResourceManager.canCreateWindow('consultation')
      expect(canCreate).toBe(false) // 由于内存使用过高，不能创建新窗口

      // 强制关闭最旧的窗口
      const closedWindowId =
        await windowResourceManager.forceCloseOldestWindow()
      expect(closedWindowId).toBe('old-window')
      expect(mockInvoke).toHaveBeenCalledWith('close_window_by_id', {
        windowId: 'old-window',
      })
    })
  })
})
