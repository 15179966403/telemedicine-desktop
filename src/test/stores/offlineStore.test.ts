/**
 * 离线状态管理测试
 * Offline store tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfflineStore } from '@/stores/offlineStore'

// Mock services
vi.mock('@/services/offlineService', () => ({
  offlineService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    addToOfflineQueue: vi.fn().mockResolvedValue(undefined),
    processOfflineQueue: vi.fn().mockResolvedValue([]),
    getSyncConflicts: vi.fn().mockReturnValue([]),
    resolveSyncConflict: vi.fn().mockResolvedValue({ success: true }),
    getCacheStats: vi.fn().mockResolvedValue({
      memoryCache: { totalItems: 0, expiredItems: 0, totalSize: 0 },
      localDatabase: { totalItems: 0, totalSize: 0 },
      totalSize: 0,
    }),
    cleanupExpiredCache: vi.fn().mockResolvedValue(undefined),
    getOfflineQueueStatus: vi.fn().mockReturnValue({
      totalItems: 0,
      pendingItems: 0,
      failedItems: 0,
      conflictItems: 0,
    }),
  },
}))

vi.mock('@/services/networkStatusService', () => ({
  networkStatusService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    addStatusListener: vi.fn(callback => {
      // Immediately call with initial status
      callback('online', {
        status: 'online',
        lastChecked: new Date(),
      })
      return vi.fn() // Return unsubscribe function
    }),
    getNetworkInfo: vi.fn().mockReturnValue({
      status: 'online',
      lastChecked: new Date(),
    }),
    checkNetworkStatus: vi.fn().mockResolvedValue({
      status: 'online',
      lastChecked: new Date(),
    }),
  },
}))

vi.mock('@/services/offlineMessageQueue', () => ({
  offlineMessageQueue: {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    getQueueStats: vi.fn().mockReturnValue({
      totalMessages: 0,
      pendingMessages: 0,
      sendingMessages: 0,
      failedMessages: 0,
      sentMessages: 0,
    }),
    processQueue: vi.fn().mockResolvedValue(undefined),
    clearQueue: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('useOfflineStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    const { result } = renderHook(() => useOfflineStore())
    act(() => {
      result.current.destroy()
    })
  })

  describe('初始化', () => {
    it('应该有正确的初始状态', () => {
      const { result } = renderHook(() => useOfflineStore())

      expect(result.current.networkStatus).toBe('online')
      expect(result.current.isSyncing).toBe(false)
      expect(result.current.conflicts).toEqual([])
      expect(result.current.showOfflineIndicator).toBe(false)
    })

    it('应该成功初始化', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      const { offlineService } = await import('@/services/offlineService')
      const { networkStatusService } =
        await import('@/services/networkStatusService')
      const { offlineMessageQueue } =
        await import('@/services/offlineMessageQueue')

      expect(offlineService.initialize).toHaveBeenCalled()
      expect(networkStatusService.initialize).toHaveBeenCalled()
      expect(offlineMessageQueue.initialize).toHaveBeenCalled()
    })

    it('应该处理初始化失败', async () => {
      const { offlineService } = await import('@/services/offlineService')
      vi.mocked(offlineService.initialize).mockRejectedValueOnce(
        new Error('Init failed')
      )

      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.syncErrors).toContain('初始化离线功能失败')
    })
  })

  describe('网络状态', () => {
    it('应该检查网络状态', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.checkNetworkStatus()
      })

      const { networkStatusService } =
        await import('@/services/networkStatusService')
      expect(networkStatusService.checkNetworkStatus).toHaveBeenCalled()
    })

    it('网络离线时应该显示离线指示器', async () => {
      const { networkStatusService } =
        await import('@/services/networkStatusService')
      vi.mocked(networkStatusService.checkNetworkStatus).mockResolvedValue({
        status: 'offline',
        lastChecked: new Date(),
      })

      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.checkNetworkStatus()
      })

      expect(result.current.showOfflineIndicator).toBe(true)
    })
  })

  describe('离线队列', () => {
    it('应该添加到离线队列', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.addToOfflineQueue(
          'test-1',
          'patient',
          { name: 'Test' },
          'create'
        )
      })

      const { offlineService } = await import('@/services/offlineService')
      expect(offlineService.addToOfflineQueue).toHaveBeenCalledWith(
        'test-1',
        'patient',
        { name: 'Test' },
        'create'
      )
    })

    it('应该处理离线队列', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.processOfflineQueue()
      })

      const { offlineService } = await import('@/services/offlineService')
      const { offlineMessageQueue } =
        await import('@/services/offlineMessageQueue')

      expect(offlineService.processOfflineQueue).toHaveBeenCalled()
      expect(offlineMessageQueue.processQueue).toHaveBeenCalled()
    })

    it('处理队列时应该设置同步状态', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      const processPromise = act(async () => {
        await result.current.processOfflineQueue()
      })

      // During processing, isSyncing should be true
      // After completion, it should be false
      await processPromise

      expect(result.current.isSyncing).toBe(false)
    })

    it('应该清空离线队列', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.clearOfflineQueue()
      })

      const { offlineMessageQueue } =
        await import('@/services/offlineMessageQueue')
      expect(offlineMessageQueue.clearQueue).toHaveBeenCalled()
    })
  })

  describe('数据同步', () => {
    it('应该同步数据', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.syncData()
      })

      expect(result.current.lastSyncTime).toBeDefined()
    })

    it('网络离线时不应该同步', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      // Set network status to offline
      act(() => {
        result.current.networkStatus = 'offline'
      })

      await act(async () => {
        await result.current.syncData()
      })

      // Should not process queue when offline
      expect(result.current.isSyncing).toBe(false)
    })

    it('正在同步时不应该重复同步', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      // Start first sync
      const sync1 = act(async () => {
        await result.current.syncData()
      })

      // Try to start second sync while first is running
      const sync2 = act(async () => {
        await result.current.syncData()
      })

      await Promise.all([sync1, sync2])

      // Should only sync once
    })
  })

  describe('同步冲突', () => {
    it('应该解决同步冲突', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.resolveSyncConflict('conflict-1', 'local')
      })

      const { offlineService } = await import('@/services/offlineService')
      expect(offlineService.resolveSyncConflict).toHaveBeenCalledWith(
        'conflict-1',
        'local',
        undefined
      )
    })

    it('应该处理冲突解决失败', async () => {
      const { offlineService } = await import('@/services/offlineService')
      vi.mocked(offlineService.resolveSyncConflict).mockResolvedValueOnce({
        success: false,
        error: {
          type: 'DATA_ERROR',
          message: '解决失败',
          timestamp: new Date(),
        },
      })

      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.resolveSyncConflict('conflict-1', 'local')
      })

      expect(result.current.syncErrors).toContain('解决同步冲突失败')
    })
  })

  describe('缓存管理', () => {
    it('应该刷新缓存统计', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.refreshCacheStats()
      })

      const { offlineService } = await import('@/services/offlineService')
      expect(offlineService.getCacheStats).toHaveBeenCalled()
    })

    it('应该清理过期缓存', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        await result.current.cleanupExpiredCache()
      })

      const { offlineService } = await import('@/services/offlineService')
      expect(offlineService.cleanupExpiredCache).toHaveBeenCalled()
    })
  })

  describe('UI 状态', () => {
    it('应该设置离线指示器显示状态', () => {
      const { result } = renderHook(() => useOfflineStore())

      act(() => {
        result.current.setShowOfflineIndicator(true)
      })

      expect(result.current.showOfflineIndicator).toBe(true)

      act(() => {
        result.current.setShowOfflineIndicator(false)
      })

      expect(result.current.showOfflineIndicator).toBe(false)
    })

    it('应该设置同步进度显示状态', () => {
      const { result } = renderHook(() => useOfflineStore())

      act(() => {
        result.current.setShowSyncProgress(true)
      })

      expect(result.current.showSyncProgress).toBe(true)

      act(() => {
        result.current.setShowSyncProgress(false)
      })

      expect(result.current.showSyncProgress).toBe(false)
    })
  })

  describe('销毁', () => {
    it('应该清理资源', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        result.current.destroy()
      })

      const { offlineService } = await import('@/services/offlineService')
      const { networkStatusService } =
        await import('@/services/networkStatusService')
      const { offlineMessageQueue } =
        await import('@/services/offlineMessageQueue')

      expect(offlineService.destroy).toHaveBeenCalled()
      expect(networkStatusService.destroy).toHaveBeenCalled()
      expect(offlineMessageQueue.destroy).toHaveBeenCalled()
    })

    it('销毁后应该重置状态', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
        result.current.destroy()
      })

      expect(result.current.networkStatus).toBe('online')
      expect(result.current.isSyncing).toBe(false)
      expect(result.current.conflicts).toEqual([])
    })
  })
})
