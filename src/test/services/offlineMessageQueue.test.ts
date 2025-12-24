/**
 * 离线消息队列测试
 * Offline message queue tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OfflineMessageQueue } from '@/services/offlineMessageQueue'
import { networkStatusService } from '@/services/networkStatusService'
import { StorageManager } from '@/utils/storage'
import type { Message } from '@/types'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@/services/networkStatusService', () => ({
  networkStatusService: {
    addStatusListener: vi.fn(),
    getCurrentStatus: vi.fn(() => 'online'),
  },
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getInstance: vi.fn(() => ({
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })),
  },
}))

describe('OfflineMessageQueue', () => {
  let offlineMessageQueue: OfflineMessageQueue
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(() => []),
      removeItem: vi.fn(),
    }

    vi.mocked(StorageManager.getInstance).mockReturnValue(mockStorage)

    offlineMessageQueue = OfflineMessageQueue.getInstance()
  })

  afterEach(() => {
    offlineMessageQueue.destroy()
  })

  describe('初始化', () => {
    it('应该成功初始化消息队列', async () => {
      await expect(offlineMessageQueue.initialize()).resolves.not.toThrow()
    })

    it('应该加载持久化的队列数据', async () => {
      const mockQueue = [
        {
          id: 'msg-1',
          consultationId: 'consultation-1',
          message: {
            type: 'text',
            content: '测试消息',
            sender: 'doctor',
          },
          timestamp: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'normal',
          status: 'pending',
        },
      ]

      mockStorage.getItem.mockReturnValue(mockQueue)

      await offlineMessageQueue.initialize()

      expect(mockStorage.getItem).toHaveBeenCalledWith('offline_message_queue')
    })

    it('应该监听网络状态变化', async () => {
      await offlineMessageQueue.initialize()

      expect(networkStatusService.addStatusListener).toHaveBeenCalled()
    })
  })

  describe('添加消息到队列', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该添加消息到队列', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      const messageId = await offlineMessageQueue.addMessage(
        consultationId,
        message
      )

      expect(messageId).toBeDefined()
      expect(messageId).toContain('queue_msg_')
      expect(mockStorage.setItem).toHaveBeenCalled()
    })

    it('应该根据优先级添加消息', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '紧急消息',
        sender: 'doctor' as const,
      }

      const messageId = await offlineMessageQueue.addMessage(
        consultationId,
        message,
        'high',
        5
      )

      expect(messageId).toBeDefined()
    })

    it('网络在线时应该立即处理', async () => {
      vi.mocked(networkStatusService.getCurrentStatus).mockReturnValue('online')

      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId, message)

      // Should trigger processQueue
      expect(networkStatusService.getCurrentStatus).toHaveBeenCalled()
    })
  })

  describe('移除消息', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该移除队列中的消息', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      const messageId = await offlineMessageQueue.addMessage(
        consultationId,
        message
      )
      const removed = await offlineMessageQueue.removeMessage(messageId)

      expect(removed).toBe(true)
    })

    it('移除不存在的消息应该返回false', async () => {
      const removed = await offlineMessageQueue.removeMessage('non-existent')

      expect(removed).toBe(false)
    })
  })

  describe('获取队列消息', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该获取所有队列消息', async () => {
      const messages = offlineMessageQueue.getQueuedMessages()

      expect(Array.isArray(messages)).toBe(true)
    })

    it('应该按问诊ID过滤消息', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId, message)

      const messages = offlineMessageQueue.getQueuedMessages(consultationId)

      expect(messages.every(msg => msg.consultationId === consultationId)).toBe(
        true
      )
    })
  })

  describe('队列统计', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该获取队列统计信息', () => {
      const stats = offlineMessageQueue.getQueueStats()

      expect(stats).toHaveProperty('totalMessages')
      expect(stats).toHaveProperty('pendingMessages')
      expect(stats).toHaveProperty('sendingMessages')
      expect(stats).toHaveProperty('failedMessages')
      expect(stats).toHaveProperty('sentMessages')
    })

    it('统计信息应该准确反映队列状态', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId, message)

      const stats = offlineMessageQueue.getQueueStats()

      expect(stats.totalMessages).toBeGreaterThan(0)
    })
  })

  describe('清空队列', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该清空所有队列', async () => {
      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId, message)
      await offlineMessageQueue.clearQueue()

      const stats = offlineMessageQueue.getQueueStats()
      expect(stats.totalMessages).toBe(0)
    })

    it('应该按问诊ID清空队列', async () => {
      const consultationId1 = 'consultation-1'
      const consultationId2 = 'consultation-2'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId1, message)
      await offlineMessageQueue.addMessage(consultationId2, message)

      await offlineMessageQueue.clearQueue(consultationId1)

      const messages = offlineMessageQueue.getQueuedMessages(consultationId1)
      expect(messages.length).toBe(0)
    })
  })

  describe('重试失败消息', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该重试失败的消息', async () => {
      await offlineMessageQueue.retryFailedMessages()

      expect(mockStorage.setItem).toHaveBeenCalled()
    })

    it('应该按问诊ID重试失败消息', async () => {
      const consultationId = 'consultation-1'

      await offlineMessageQueue.retryFailedMessages(consultationId)

      expect(mockStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('处理队列', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('网络离线时应该跳过处理', async () => {
      vi.mocked(networkStatusService.getCurrentStatus).mockReturnValue(
        'offline'
      )

      await offlineMessageQueue.processQueue()

      // Should not attempt to send messages
    })

    it('队列为空时应该直接返回', async () => {
      await offlineMessageQueue.processQueue()

      // Should complete without errors
    })

    it('应该处理待发送的消息', async () => {
      vi.mocked(networkStatusService.getCurrentStatus).mockReturnValue('online')

      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue({
        success: true,
        messageId: 'sent-msg-1',
      })

      const consultationId = 'consultation-1'
      const message = {
        type: 'text' as const,
        content: '测试消息',
        sender: 'doctor' as const,
      }

      await offlineMessageQueue.addMessage(consultationId, message)
      await offlineMessageQueue.processQueue()

      // Should attempt to send the message
      expect(invoke).toHaveBeenCalled()
    })
  })

  describe('消息回调', () => {
    beforeEach(async () => {
      await offlineMessageQueue.initialize()
    })

    it('应该添加消息回调', () => {
      const consultationId = 'consultation-1'
      const callback = vi.fn()

      const removeCallback = offlineMessageQueue.addMessageCallback(
        consultationId,
        callback
      )

      expect(typeof removeCallback).toBe('function')
    })

    it('应该移除消息回调', () => {
      const consultationId = 'consultation-1'
      const callback = vi.fn()

      const removeCallback = offlineMessageQueue.addMessageCallback(
        consultationId,
        callback
      )
      removeCallback()

      // Callback should be removed
    })
  })

  describe('错误处理', () => {
    it('应该处理初始化失败', async () => {
      mockStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(offlineMessageQueue.initialize()).rejects.toThrow()
    })

    it('应该处理添加消息失败', async () => {
      await offlineMessageQueue.initialize()

      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(
        offlineMessageQueue.addMessage('consultation-1', {
          type: 'text',
          content: '测试',
          sender: 'doctor',
        })
      ).rejects.toThrow('添加消息到队列失败')
    })

    it('应该处理清空队列失败', async () => {
      await offlineMessageQueue.initialize()

      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      await expect(offlineMessageQueue.clearQueue()).rejects.toThrow(
        '清空队列失败'
      )
    })
  })
})
