import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageService } from '@/services/messageService'
import { invoke } from '@tauri-apps/api/core'
import type { Message, SendMessageRequest, FileInfo } from '@/types'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe('MessageService', () => {
  let messageService: MessageService

  beforeEach(() => {
    // Reset the singleton instance
    MessageService['instance'] = undefined as any
    messageService = MessageService.getInstance()
    // Reset to online state
    messageService.setOnlineStatus(true)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        id: 'msg-123',
        consultation_id: 'consultation-1',
        message_type: 'text',
        content: '测试消息',
        sender: 'doctor',
        timestamp: '2024-01-20T10:00:00Z',
        status: 'sent',
        file_path: null,
      }

      mockInvoke.mockResolvedValue(mockResponse)

      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
      }

      const result = await messageService.sendMessage('consultation-1', message)

      expect(mockInvoke).toHaveBeenCalledWith('send_message', {
        request: {
          consultationId: 'consultation-1',
          type: 'text',
          content: '测试消息',
          fileId: undefined,
        },
      })

      expect(result).toEqual({
        id: 'msg-123',
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
        timestamp: new Date('2024-01-20T10:00:00Z'),
        status: 'sent',
        fileInfo: undefined,
      })
    })

    it('should handle send message failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'))

      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
      }

      await expect(
        messageService.sendMessage('consultation-1', message)
      ).rejects.toThrow('发送消息失败')
    })

    it('should add message to queue when offline', async () => {
      messageService.setOnlineStatus(false)

      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
      }

      await expect(
        messageService.sendMessage('consultation-1', message)
      ).rejects.toThrow('网络连接异常，消息已加入发送队列')

      expect(messageService.getQueuedMessageCount('consultation-1')).toBe(1)
    })
  })

  describe('getMessageHistory', () => {
    it('should get message history successfully', async () => {
      const mockResponse = {
        messages: [
          {
            id: 'msg-1',
            consultation_id: 'consultation-1',
            message_type: 'text',
            content: '历史消息1',
            sender: 'patient',
            timestamp: '2024-01-20T09:00:00Z',
            status: 'delivered',
            file_path: null,
          },
          {
            id: 'msg-2',
            consultation_id: 'consultation-1',
            message_type: 'text',
            content: '历史消息2',
            sender: 'doctor',
            timestamp: '2024-01-20T09:05:00Z',
            status: 'delivered',
            file_path: null,
          },
        ],
        total: 2,
        page: 1,
        has_more: false,
      }

      mockInvoke.mockResolvedValue(mockResponse)

      const result = await messageService.getMessageHistory(
        'consultation-1',
        1,
        20
      )

      expect(mockInvoke).toHaveBeenCalledWith('get_message_history', {
        consultationId: 'consultation-1',
        page: 1,
        limit: 20,
      })

      expect(result).toEqual({
        messages: [
          {
            id: 'msg-1',
            consultationId: 'consultation-1',
            type: 'text',
            content: '历史消息1',
            sender: 'patient',
            timestamp: new Date('2024-01-20T09:00:00Z'),
            status: 'delivered',
            fileInfo: undefined,
          },
          {
            id: 'msg-2',
            consultationId: 'consultation-1',
            type: 'text',
            content: '历史消息2',
            sender: 'doctor',
            timestamp: new Date('2024-01-20T09:05:00Z'),
            status: 'delivered',
            fileInfo: undefined,
          },
        ],
        total: 2,
        page: 1,
        hasMore: false,
      })
    })

    it('should handle get message history failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'))

      await expect(
        messageService.getMessageHistory('consultation-1', 1, 20)
      ).rejects.toThrow('获取消息历史失败')
    })
  })

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockResponse = {
        url: 'https://cdn.example.com/file.jpg',
        path: '/uploads/file.jpg',
      }

      mockInvoke.mockResolvedValue(mockResponse)

      const file = new File(['test content'], 'test.jpg', {
        type: 'image/jpeg',
      })
      const result = await messageService.uploadFile(file)

      expect(mockInvoke).toHaveBeenCalledWith('upload_file', {
        fileData: expect.any(Array),
        fileName: 'test.jpg',
      })

      expect(result).toEqual({
        id: expect.any(String),
        name: 'test.jpg',
        size: file.size,
        type: 'image/jpeg',
        url: 'https://cdn.example.com/file.jpg',
        localPath: '/uploads/file.jpg',
      })
    })

    it('should handle upload file failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Upload error'))

      const file = new File(['test content'], 'test.jpg', {
        type: 'image/jpeg',
      })

      await expect(messageService.uploadFile(file)).rejects.toThrow(
        '文件上传失败'
      )
    })
  })

  describe('message queue', () => {
    it('should process message queue when going online', async () => {
      // Set offline and add messages to queue
      messageService.setOnlineStatus(false)

      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-1',
        type: 'text',
        content: '队列消息',
        sender: 'doctor',
      }

      // This should add to queue
      try {
        await messageService.sendMessage('consultation-1', message)
      } catch (error) {
        expect(error.message).toBe('网络连接异常，消息已加入发送队列')
      }

      expect(messageService.getQueuedMessageCount()).toBe(1)

      // Mock successful send
      mockInvoke.mockResolvedValue({
        id: 'msg-123',
        consultation_id: 'consultation-1',
        message_type: 'text',
        content: '队列消息',
        sender: 'doctor',
        timestamp: '2024-01-20T10:00:00Z',
        status: 'sent',
      })

      // Go online - should process queue
      messageService.setOnlineStatus(true)

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(messageService.getQueuedMessageCount()).toBe(0)
    })

    it('should get queued message count for specific consultation', async () => {
      messageService.setOnlineStatus(false)

      const message1: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-1',
        type: 'text',
        content: '消息1',
        sender: 'doctor',
      }

      const message2: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId: 'consultation-2',
        type: 'text',
        content: '消息2',
        sender: 'doctor',
      }

      // Add messages to different consultations
      try {
        await messageService.sendMessage('consultation-1', message1)
      } catch (error) {
        // Expected to fail and add to queue
      }

      try {
        await messageService.sendMessage('consultation-2', message2)
      } catch (error) {
        // Expected to fail and add to queue
      }

      expect(messageService.getQueuedMessageCount('consultation-1')).toBe(1)
      expect(messageService.getQueuedMessageCount('consultation-2')).toBe(1)
      expect(messageService.getQueuedMessageCount()).toBe(2)
    })
  })

  describe('subscribeToMessages', () => {
    it('should subscribe to messages and receive callbacks', () => {
      const callback = vi.fn()
      const unsubscribe = messageService.subscribeToMessages(
        'consultation-1',
        callback
      )

      expect(typeof unsubscribe).toBe('function')

      // Clean up
      unsubscribe()
    })

    it('should unsubscribe from messages', () => {
      const callback = vi.fn()
      const unsubscribe = messageService.subscribeToMessages(
        'consultation-1',
        callback
      )

      // Should be subscribed
      expect(messageService['subscribers'].has('consultation-1')).toBe(true)

      // Unsubscribe
      unsubscribe()

      // Should be unsubscribed
      expect(messageService['subscribers'].has('consultation-1')).toBe(false)
    })
  })

  describe('retryFailedMessage', () => {
    it('should retry failed message successfully', async () => {
      const mockResponse = {
        id: 'msg-retry-123',
        consultation_id: 'consultation-1',
        message_type: 'text',
        content: '重试消息',
        sender: 'doctor',
        timestamp: '2024-01-20T10:00:00Z',
        status: 'sent',
      }

      mockInvoke.mockResolvedValue(mockResponse)

      const failedMessage: Message = {
        id: 'msg-failed',
        consultationId: 'consultation-1',
        type: 'text',
        content: '重试消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'failed',
      }

      const result = await messageService.retryFailedMessage(failedMessage)

      expect(result.status).toBe('sent')
      expect(result.content).toBe('重试消息')
    })

    it('should handle retry failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Retry failed'))

      const failedMessage: Message = {
        id: 'msg-failed',
        consultationId: 'consultation-1',
        type: 'text',
        content: '重试消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'failed',
      }

      await expect(
        messageService.retryFailedMessage(failedMessage)
      ).rejects.toThrow('重发消息失败')
    })
  })

  describe('online status', () => {
    it('should get and set online status', () => {
      expect(messageService.getOnlineStatus()).toBe(true)

      messageService.setOnlineStatus(false)
      expect(messageService.getOnlineStatus()).toBe(false)

      messageService.setOnlineStatus(true)
      expect(messageService.getOnlineStatus()).toBe(true)
    })
  })
})
