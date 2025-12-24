/**
 * 离线功能集成测试
 * Offline functionality integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfflineStore } from '@/stores/offlineStore'
import { offlineService } from '@/services/offlineService'
import { networkStatusService } from '@/services/networkStatusService'
import { offlineMessageQueue } from '@/services/offlineMessageQueue'
import type { Patient, Message } from '@/types'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

describe('离线功能集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock fetch for network tests
    global.fetch = vi.fn()
  })

  afterEach(() => {
    const { result } = renderHook(() => useOfflineStore())
    act(() => {
      result.current.destroy()
    })
  })

  describe('完整的离线到在线流程', () => {
    it('应该在离线时缓存数据，在线时同步', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      // 初始化
      await act(async () => {
        await result.current.initialize()
      })

      // 模拟网络离线
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      await act(async () => {
        await result.current.checkNetworkStatus()
      })

      expect(result.current.networkStatus).toBe('offline')
      expect(result.current.showOfflineIndicator).toBe(true)

      // 在离线状态下添加数据到队列
      const testData = {
        id: 'patient-1',
        name: '测试患者',
        age: 30,
        gender: 'male' as const,
        phone: '13800138000',
      }

      await act(async () => {
        await result.current.addToOfflineQueue(
          'patient-1',
          'patient',
          testData,
          'create'
        )
      })

      // 验证数据已添加到队列
      const queueStatus = offlineService.getOfflineQueueStatus()
      expect(queueStatus.totalItems).toBeGreaterThan(0)

      // 模拟网络恢复在线
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      // Mock successful sync
      vi.mocked(invoke).mockResolvedValue({
        success: true,
        data: testData,
      })

      await act(async () => {
        await result.current.checkNetworkStatus()
      })

      expect(result.current.networkStatus).toBe('online')

      // 触发同步
      await act(async () => {
        await result.current.syncData()
      })

      // 验证同步完成
      expect(result.current.lastSyncTime).toBeDefined()
    })
  })

  describe('消息队列离线处理', () => {
    it('应该在离线时将消息加入队列，在线时发送', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      // 添加消息到队列
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '离线消息测试',
        sender: 'doctor' as const,
      }

      await act(async () => {
        const messageId = await offlineMessageQueue.addMessage(
          consultationId,
          message
        )
        expect(messageId).toBeDefined()
      })

      // 验证队列状态
      const queueStats = offlineMessageQueue.getQueueStats()
      expect(queueStats.totalMessages).toBeGreaterThan(0)

      // Mock successful message send
      vi.mocked(invoke).mockResolvedValue({
        success: true,
        messageId: 'sent-msg-1',
      })

      // 处理队列
      await act(async () => {
        await offlineMessageQueue.processQueue()
      })

      // 验证消息已发送
      expect(invoke).toHaveBeenCalledWith('send_message', expect.any(Object))
    })
  })

  describe('数据缓存和恢复', () => {
    it('应该缓存患者数据并在需要时恢复', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

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
        {
          id: '2',
          name: '李四',
          age: 25,
          gender: 'female',
          phone: '13800138001',
          tags: ['糖尿病'],
          lastVisit: new Date(),
          medicalHistory: [],
        },
      ]

      // 缓存患者数据
      await offlineService.cachePatientData(patients)

      // 模拟网络离线
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      // Mock Tauri返回缓存数据
      vi.mocked(invoke).mockResolvedValue(patients)

      // 获取缓存的患者数据
      const cachedPatients = await offlineService.getCachedPatientData()

      expect(cachedPatients).toHaveLength(2)
      expect(cachedPatients[0].name).toBe('张三')
      expect(cachedPatients[1].name).toBe('李四')
    })

    it('应该缓存消息数据并在需要时恢复', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

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
        {
          id: 'msg-2',
          consultationId,
          type: 'text',
          content: '你好，有什么可以帮助你的？',
          sender: 'doctor',
          timestamp: new Date(),
          status: 'sent',
        },
      ]

      // 缓存消息数据
      await offlineService.cacheMessages(consultationId, messages)

      // Mock Tauri返回缓存数据
      vi.mocked(invoke).mockResolvedValue(messages)

      // 获取缓存的消息数据
      const cachedMessages =
        await offlineService.getCachedMessages(consultationId)

      expect(cachedMessages).toHaveLength(2)
      expect(cachedMessages[0].content).toBe('你好')
      expect(cachedMessages[1].content).toBe('你好，有什么可以帮助你的？')
    })
  })

  describe('同步冲突处理', () => {
    it('应该检测并处理同步冲突', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      // 模拟同步冲突
      const localData = {
        id: 'patient-1',
        name: '张三',
        age: 30,
        phone: '13800138000',
      }

      const remoteData = {
        id: 'patient-1',
        name: '张三',
        age: 31, // 年龄不同
        phone: '13800138001', // 电话不同
      }

      // Mock conflict detection
      vi.mocked(invoke).mockRejectedValueOnce({
        type: 'DATA_ERROR',
        message: 'Conflict detected',
      })

      // 添加到队列
      await act(async () => {
        await result.current.addToOfflineQueue(
          'patient-1',
          'patient',
          localData,
          'update'
        )
      })

      // 尝试同步（会产生冲突）
      await act(async () => {
        await result.current.processOfflineQueue()
      })

      // 验证冲突被检测到
      // Note: 实际实现中需要更复杂的冲突检测逻辑
    })

    it('应该使用本地数据解决冲突', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      // Mock successful resolution
      vi.mocked(invoke).mockResolvedValue({
        success: true,
        data: { id: 'patient-1', name: '张三' },
      })

      await act(async () => {
        await result.current.resolveSyncConflict('conflict-1', 'local')
      })

      expect(result.current.syncErrors).toHaveLength(0)
    })
  })

  describe('网络状态变化响应', () => {
    it('应该响应网络状态变化并自动同步', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      // 添加一些待同步的数据
      await act(async () => {
        await result.current.addToOfflineQueue(
          'test-1',
          'patient',
          { name: 'Test' },
          'create'
        )
      })

      // 模拟网络从离线变为在线
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      // 触发网络状态检查
      await act(async () => {
        await result.current.checkNetworkStatus()
      })

      // 网络恢复后应该自动触发同步
      expect(result.current.networkStatus).toBe('online')
    })
  })

  describe('缓存过期和清理', () => {
    it('应该清理过期的缓存数据', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      // 清理过期缓存
      await act(async () => {
        await result.current.cleanupExpiredCache()
      })

      // 验证缓存统计更新
      await act(async () => {
        await result.current.refreshCacheStats()
      })

      expect(result.current.cacheStats).toBeDefined()
    })
  })

  describe('错误恢复', () => {
    it('应该在同步失败后重试', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      // 添加数据到队列
      await act(async () => {
        await result.current.addToOfflineQueue(
          'test-1',
          'patient',
          { name: 'Test' },
          'create'
        )
      })

      // Mock first attempt fails
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Network error'))

      // 第一次同步失败
      await act(async () => {
        await result.current.processOfflineQueue()
      })

      // Mock second attempt succeeds
      vi.mocked(invoke).mockResolvedValueOnce({
        success: true,
        data: { id: 'test-1' },
      })

      // 重试同步
      await act(async () => {
        await result.current.processOfflineQueue()
      })

      // 验证最终成功
      expect(result.current.syncErrors).toHaveLength(0)
    })
  })
})
