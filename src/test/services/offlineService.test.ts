/**
 * 离线服务测试
 * Offline service tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OfflineService } from '@/services/offlineService'
import { StorageManager, CacheManager } from '@/utils/storage'
import type { Patient, Message } from '@/types'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock storage managers
vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getInstance: vi.fn(() => ({
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      getAllKeys: vi.fn(() => []),
    })),
  },
  CacheManager: {
    getInstance: vi.fn(() => ({
      setCache: vi.fn(),
      getCache: vi.fn(),
      removeCache: vi.fn(),
      clearExpiredCache: vi.fn(),
      getCacheStats: vi.fn(() => ({
        totalItems: 0,
        expiredItems: 0,
        totalSize: 0,
      })),
    })),
  },
}))

describe('OfflineService', () => {
  let offlineService: OfflineService
  let mockStorage: any
  let mockCache: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create mock instances
    mockStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      getAllKeys: vi.fn(() => []),
    }

    mockCache = {
      setCache: vi.fn(),
      getCache: vi.fn(),
      removeCache: vi.fn(),
      clearExpiredCache: vi.fn(),
      getCacheStats: vi.fn(() => ({
        totalItems: 0,
        expiredItems: 0,
        totalSize: 0,
      })),
    }

    // Mock the getInstance methods
    vi.mocked(StorageManager.getInstance).mockReturnValue(mockStorage)
    vi.mocked(CacheManager.getInstance).mockReturnValue(mockCache)

    // Create service instance
    offlineService = OfflineService.getInstance()
  })

  afterEach(() => {
    offlineService.destroy()
  })

  describe('初始化', () => {
    it('应该成功初始化离线服务', async () => {
      mockStorage.getItem.mockReturnValue([])

      await expect(offlineService.initialize()).resolves.not.toThrow()
    })

    it('应该加载现有的离线队列', async () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'patient',
          data: { id: '1', name: 'Test Patient' },
          operation: 'create',
          timestamp: new Date(),
          syncStatus: 'pending',
          retryCount: 0,
        },
      ]

      mockStorage.getItem.mockReturnValue(mockQueue)

      await offlineService.initialize()

      expect(mockStorage.getItem).toHaveBeenCalledWith('offline_queue')
    })
  })

  describe('患者数据缓存', () => {
    beforeEach(async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()
    })

    it('应该缓存患者数据', async () => {
      const patients: Patient[] = [
        {
          id: '1',
          name: '张三',
          age: 30,
          gender: 'male',
          phone: '13800138000',
          tags: ['高血压'],
          lastVisit: new Date(),
          medicalHistory: [],
        },
      ]

      await offlineService.cachePatientData(patients)

      expect(mockCache.setCache).toHaveBeenCalledWith(
        'offline_patients',
        patients,
        24 * 60 * 60 * 1000
      )
    })

    it('应该获取缓存的患者数据', async () => {
      const patients: Patient[] = [
        {
          id: '1',
          name: '张三',
          age: 30,
          gender: 'male',
          phone: '13800138000',
          tags: ['高血压'],
          lastVisit: new Date(),
          medicalHistory: [],
        },
      ]

      mockCache.getCache.mockReturnValue(patients)

      const result = await offlineService.getCachedPatientData()

      expect(result).toEqual(patients)
      expect(mockCache.getCache).toHaveBeenCalledWith('offline_patients')
    })

    it('缓存未命中时应该返回空数组', async () => {
      mockCache.getCache.mockReturnValue(null)

      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue([])

      const result = await offlineService.getCachedPatientData()

      expect(result).toEqual([])
    })
  })

  describe('消息数据缓存', () => {
    beforeEach(async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()
    })

    it('应该缓存消息数据', async () => {
      const consultationId = 'consultation-1'
      const messages: Message[] = [
        {
          id: 'msg-1',
          consultationId,
          type: 'text',
          content: '你好',
          sender: 'patient',
          timestamp: new Date(),
          status: 'sent',
        },
      ]

      await offlineService.cacheMessages(consultationId, messages)

      expect(mockCache.setCache).toHaveBeenCalledWith(
        `offline_messages_${consultationId}`,
        messages,
        12 * 60 * 60 * 1000
      )
    })

    it('应该获取缓存的消息数据', async () => {
      const consultationId = 'consultation-1'
      const messages: Message[] = [
        {
          id: 'msg-1',
          consultationId,
          type: 'text',
          content: '你好',
          sender: 'patient',
          timestamp: new Date(),
          status: 'sent',
        },
      ]

      mockCache.getCache.mockReturnValue(messages)

      const result = await offlineService.getCachedMessages(consultationId)

      expect(result).toEqual(messages)
      expect(mockCache.getCache).toHaveBeenCalledWith(
        `offline_messages_${consultationId}`
      )
    })
  })

  describe('离线队列管理', () => {
    beforeEach(async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()
    })

    it('应该添加项目到离线队列', async () => {
      const testData = { id: '1', name: 'Test Patient' }

      await offlineService.addToOfflineQueue(
        'test-1',
        'patient',
        testData,
        'create'
      )

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'offline_queue',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test-1',
            type: 'patient',
            data: testData,
            operation: 'create',
            syncStatus: 'pending',
            retryCount: 0,
          }),
        ])
      )
    })

    it('应该获取离线队列状态', async () => {
      // 模拟队列中有一些项目
      const mockQueue = [
        {
          id: 'test-1',
          type: 'patient',
          data: {},
          operation: 'create',
          timestamp: new Date(),
          syncStatus: 'pending',
          retryCount: 0,
        },
        {
          id: 'test-2',
          type: 'message',
          data: {},
          operation: 'create',
          timestamp: new Date(),
          syncStatus: 'failed',
          retryCount: 2,
        },
      ]

      // 直接设置队列状态（模拟内部状态）
      await offlineService.addToOfflineQueue('test-1', 'patient', {}, 'create')
      await offlineService.addToOfflineQueue('test-2', 'message', {}, 'create')

      const status = offlineService.getOfflineQueueStatus()

      expect(status.totalItems).toBeGreaterThan(0)
      expect(status.pendingItems).toBeGreaterThanOrEqual(0)
    })
  })

  describe('同步冲突管理', () => {
    beforeEach(async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()
    })

    it('应该获取同步冲突列表', () => {
      const conflicts = offlineService.getSyncConflicts()
      expect(Array.isArray(conflicts)).toBe(true)
    })

    it('应该解决同步冲突', async () => {
      const conflictId = 'conflict-1'

      // 模拟冲突不存在的情况
      const result = await offlineService.resolveSyncConflict(
        conflictId,
        'local'
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('冲突不存在')
    })
  })

  describe('缓存管理', () => {
    beforeEach(async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()
    })

    it('应该清理过期缓存', async () => {
      await offlineService.cleanupExpiredCache()

      expect(mockCache.clearExpiredCache).toHaveBeenCalled()
    })

    it('应该获取缓存统计信息', async () => {
      const mockStats = {
        totalItems: 10,
        expiredItems: 2,
        totalSize: 1024,
      }

      mockCache.getCacheStats.mockReturnValue(mockStats)

      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue({ totalItems: 5, totalSize: 512 })

      const stats = await offlineService.getCacheStats()

      expect(stats.memoryCache).toEqual(mockStats)
      expect(stats.localDatabase).toEqual({ totalItems: 5, totalSize: 512 })
      expect(stats.totalSize).toBe(1536) // 1024 + 512
    })
  })

  describe('错误处理', () => {
    it('应该处理初始化失败', async () => {
      mockStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(offlineService.initialize()).rejects.toThrow()
    })

    it('应该处理缓存操作失败', async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()

      mockCache.setCache.mockImplementation(() => {
        throw new Error('Cache error')
      })

      await expect(offlineService.cachePatientData([])).rejects.toThrow(
        '缓存患者数据失败'
      )
    })

    it('应该处理队列操作失败', async () => {
      mockStorage.getItem.mockReturnValue([])
      await offlineService.initialize()

      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(
        offlineService.addToOfflineQueue('test', 'patient', {}, 'create')
      ).rejects.toThrow('添加离线操作失败')
    })
  })
})
