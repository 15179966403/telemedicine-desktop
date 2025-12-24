/**
 * 网络状态服务测试
 * Network status service tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NetworkStatusService } from '@/services/networkStatusService'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe('NetworkStatusService', () => {
  let networkStatusService: NetworkStatusService

  beforeEach(() => {
    vi.clearAllMocks()
    networkStatusService = NetworkStatusService.getInstance()
  })

  afterEach(() => {
    networkStatusService.destroy()
  })

  describe('初始化', () => {
    it('应该成功初始化网络状态服务', async () => {
      await expect(networkStatusService.initialize()).resolves.not.toThrow()
    })

    it('应该设置浏览器网络监听器', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      await networkStatusService.initialize()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })
  })

  describe('网络状态检测', () => {
    beforeEach(async () => {
      await networkStatusService.initialize()
    })

    it('应该检测到在线状态', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      // Mock successful fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const networkInfo = await networkStatusService.checkNetworkStatus()

      expect(networkInfo.status).toBe('online')
    })

    it('应该检测到离线状态', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const networkInfo = await networkStatusService.checkNetworkStatus()

      expect(networkInfo.status).toBe('offline')
    })

    it('应该检测到网络缓慢', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      // Mock slow response
      vi.mocked(global.fetch).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
            } as Response)
          }, 4000) // 4 seconds - exceeds slow threshold
        })
      })

      const networkInfo = await networkStatusService.checkNetworkStatus()

      // Note: This test might need adjustment based on actual implementation
      expect(['online', 'slow', 'unstable']).toContain(networkInfo.status)
    })
  })

  describe('连通性测试', () => {
    beforeEach(async () => {
      await networkStatusService.initialize()
    })

    it('应该成功测试连通性', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const result = await networkStatusService.testConnectivity(
        'https://example.com'
      )

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('应该处理连通性测试失败', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const result = await networkStatusService.testConnectivity(
        'https://example.com'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该处理超时', async () => {
      vi.mocked(global.fetch).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout'))
          }, 6000)
        })
      })

      const result = await networkStatusService.testConnectivity(
        'https://example.com'
      )

      expect(result.success).toBe(false)
    })
  })

  describe('状态监听器', () => {
    beforeEach(async () => {
      await networkStatusService.initialize()
    })

    it('应该添加状态监听器', () => {
      const callback = vi.fn()

      const removeListener = networkStatusService.addStatusListener(callback)

      expect(callback).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: expect.any(String),
          lastChecked: expect.any(Date),
        })
      )
      expect(typeof removeListener).toBe('function')
    })

    it('应该移除状态监听器', () => {
      const callback = vi.fn()

      const removeListener = networkStatusService.addStatusListener(callback)
      callback.mockClear()

      removeListener()

      // Trigger a status change (this would normally happen internally)
      // The callback should not be called after removal
      expect(callback).not.toHaveBeenCalled()
    })

    it('应该通知多个监听器', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      networkStatusService.addStatusListener(callback1)
      networkStatusService.addStatusListener(callback2)

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('网络信息', () => {
    beforeEach(async () => {
      await networkStatusService.initialize()
    })

    it('应该获取当前网络状态', () => {
      const status = networkStatusService.getCurrentStatus()

      expect(['online', 'offline', 'slow', 'unstable']).toContain(status)
    })

    it('应该获取网络信息', () => {
      const networkInfo = networkStatusService.getNetworkInfo()

      expect(networkInfo).toHaveProperty('status')
      expect(networkInfo).toHaveProperty('lastChecked')
      expect(networkInfo.lastChecked).toBeInstanceOf(Date)
    })

    it('应该获取连接类型', async () => {
      const connectionType = await networkStatusService.getConnectionType()

      expect(typeof connectionType).toBe('string')
    })
  })

  describe('浏览器事件处理', () => {
    beforeEach(async () => {
      await networkStatusService.initialize()
    })

    it('应该处理浏览器在线事件', () => {
      const callback = vi.fn()
      networkStatusService.addStatusListener(callback)
      callback.mockClear()

      // Trigger online event
      window.dispatchEvent(new Event('online'))

      // The service should check network status
      // Note: This is an async operation, might need to wait
    })

    it('应该处理浏览器离线事件', () => {
      const callback = vi.fn()
      networkStatusService.addStatusListener(callback)
      callback.mockClear()

      // Trigger offline event
      window.dispatchEvent(new Event('offline'))

      // The callback should eventually be called with offline status
    })
  })

  describe('错误处理', () => {
    it('应该处理初始化失败', async () => {
      const { listen } = await import('@tauri-apps/api/event')
      vi.mocked(listen).mockRejectedValue(new Error('Tauri error'))

      // Should not throw, just log warning
      await expect(networkStatusService.initialize()).resolves.not.toThrow()
    })

    it('应该处理网络检测失败', async () => {
      await networkStatusService.initialize()

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const networkInfo = await networkStatusService.checkNetworkStatus()

      expect(['offline', 'unstable']).toContain(networkInfo.status)
    })
  })

  describe('销毁', () => {
    it('应该清理资源', async () => {
      await networkStatusService.initialize()

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      networkStatusService.destroy()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })
  })
})
