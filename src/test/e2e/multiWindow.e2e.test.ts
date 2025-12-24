/**
 * 多窗口交互端到端测试
 * Multi-Window Interaction End-to-End Tests
 * 需求覆盖: 4.1-4.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWindows } from '@/hooks/useWindows'
import { windowService } from '@/services/windowService'
import type { WindowConfig } from '@/types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}))

describe('多窗口交互端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('需求 4.1 - 创建和管理多个窗口', () => {
    it('应该能够创建新的咨询窗口', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => useWindows())

      const windowConfig: WindowConfig = {
        label: 'consultation-window-001',
        title: '患者咨询 - 张三',
        url: '/consultation/consultation-001',
        width: 1200,
        height: 800,
      }

      vi.mocked(invoke).mockResolvedValueOnce({
        success: true,
        windowId: 'win-001',
      })

      await act(async () => {
        await result.current.createWindow(windowConfig)
      })

      expect(invoke).toHaveBeenCalledWith(
        'create_window',
        expect.objectContaining({
          config: windowConfig,
        })
      )
    })

    it('应该能够关闭窗口', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => useWindows())

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await act(async () => {
        await result.current.closeWindow('win-001')
      })

      expect(invoke).toHaveBeenCalledWith('close_window', {
        windowId: 'win-001',
      })
    })

    it('应该能够最小化和恢复窗口', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => useWindows())

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await act(async () => {
        await result.current.minimizeWindow('win-001')
      })

      expect(invoke).toHaveBeenCalledWith('minimize_window', {
        windowId: 'win-001',
      })
    })
  })

  describe('需求 4.2 - 窗口间通信', () => {
    it('应该能够在窗口间发送消息', async () => {
      const { emit } = await import('@tauri-apps/api/event')

      await windowService.sendMessageToWindow('win-002', {
        type: 'NEW_MESSAGE',
        payload: { messageId: 'msg-001', content: '新消息' },
      })

      expect(emit).toHaveBeenCalledWith(
        'window-message',
        expect.objectContaining({
          targetWindow: 'win-002',
          type: 'NEW_MESSAGE',
        })
      )
    })

    it('应该能够接收来自其他窗口的消息', async () => {
      const { listen } = await import('@tauri-apps/api/event')
      const callback = vi.fn()

      vi.mocked(listen).mockResolvedValueOnce(() => {})

      await windowService.subscribeToWindowMessages(callback)

      expect(listen).toHaveBeenCalledWith(
        'window-message',
        expect.any(Function)
      )
    })
  })

  describe('需求 4.3 - 窗口状态同步', () => {
    it('应该同步窗口状态到其他窗口', async () => {
      const { emit } = await import('@tauri-apps/api/event')

      await windowService.syncWindowState('win-001', {
        consultationId: 'consultation-001',
        unreadCount: 5,
      })

      expect(emit).toHaveBeenCalledWith('window-state-sync', expect.any(Object))
    })
  })

  describe('需求 4.4 - 窗口资源管理', () => {
    it('应该限制同时打开的窗口数量', async () => {
      const { result } = renderHook(() => useWindows())

      // 模拟已有10个窗口
      act(() => {
        result.current.setWindowCount(10)
      })

      const canCreate = result.current.canCreateWindow()
      expect(canCreate).toBe(false)
    })

    it('应该在关闭窗口时清理资源', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await windowService.closeWindow('win-001')

      expect(invoke).toHaveBeenCalledWith('cleanup_window_resources', {
        windowId: 'win-001',
      })
    })
  })

  describe('需求 4.5 - 窗口持久化', () => {
    it('应该保存窗口状态', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      const windowState = {
        windowId: 'win-001',
        position: { x: 100, y: 100 },
        size: { width: 1200, height: 800 },
        consultationId: 'consultation-001',
      }

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await windowService.saveWindowState(windowState)

      expect(invoke).toHaveBeenCalledWith('save_window_state', {
        state: windowState,
      })
    })

    it('应该在启动时恢复窗口', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      const savedWindows = [
        {
          windowId: 'win-001',
          consultationId: 'consultation-001',
          position: { x: 100, y: 100 },
          size: { width: 1200, height: 800 },
        },
      ]

      vi.mocked(invoke).mockResolvedValueOnce(savedWindows)

      const windows = await windowService.restoreWindows()

      expect(invoke).toHaveBeenCalledWith('get_saved_windows')
      expect(windows).toHaveLength(1)
    })
  })
})
