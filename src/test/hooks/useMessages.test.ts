import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMessages } from '@/hooks/useMessages'
import { useMessageStore } from '@/stores/messageStore'
import { MessageService } from '@/services/messageService'
import { useErrorHandler } from '@/utils/errorHandler'
import type { Message } from '@/types'

// Mock dependencies
vi.mock('@/stores/messageStore')
vi.mock('@/services/messageService')
vi.mock('@/utils/errorHandler')

const mockUseMessageStore = vi.mocked(useMessageStore)
const mockMessageService = vi.mocked(MessageService)
const mockUseErrorHandler = vi.mocked(useErrorHandler)

const mockStoreActions = {
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  updateMessageStatus: vi.fn(),
  setActiveConversation: vi.fn(),
  markAsRead: vi.fn(),
  setLoading: vi.fn(),
  clearError: vi.fn(),
  addSendingMessage: vi.fn(),
  removeSendingMessage: vi.fn(),
  retryFailedMessages: vi.fn(),
  syncMessages: vi.fn(),
}

const mockMessageServiceInstance = {
  sendMessage: vi.fn(),
  getMessageHistory: vi.fn(),
  uploadFile: vi.fn(),
  retryFailedMessage: vi.fn(),
  markMessageAsRead: vi.fn(),
  subscribeToMessages: vi.fn(),
}

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock store state
    mockUseMessageStore.mockReturnValue({
      conversations: new Map([
        [
          'consultation-1',
          [
            {
              id: 'msg-1',
              consultationId: 'consultation-1',
              type: 'text',
              content: '测试消息',
              sender: 'doctor',
              timestamp: new Date(),
              status: 'sent',
            } as Message,
          ],
        ],
      ]),
      activeConversation: 'consultation-1',
      unreadCounts: new Map([['consultation-1', 0]]),
      loading: false,
      error: null,
      connectionStatus: 'connected',
      sendingMessages: new Set(),
      ...mockStoreActions,
    })

    // Mock MessageService
    mockMessageService.getInstance.mockReturnValue(
      mockMessageServiceInstance as any
    )

    // Mock error handler
    mockUseErrorHandler.mockReturnValue({
      handleAsyncError: vi.fn((fn, fallback) => fn().catch(() => fallback)),
    })
  })

  describe('basic functionality', () => {
    it('should return current messages for consultation', () => {
      const { result } = renderHook(() => useMessages('consultation-1'))

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].content).toBe('测试消息')
    })

    it('should return empty array when no consultation ID', () => {
      const { result } = renderHook(() => useMessages())

      expect(result.current.messages).toEqual([])
    })

    it('should return unread count for consultation', () => {
      mockUseMessageStore.mockReturnValue({
        ...mockUseMessageStore(),
        unreadCounts: new Map([['consultation-1', 5]]),
      })

      const { result } = renderHook(() => useMessages('consultation-1'))

      expect(result.current.unreadCount).toBe(5)
    })
  })

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockSentMessage: Message = {
        id: 'msg-sent',
        consultationId: 'consultation-1',
        type: 'text',
        content: '发送的消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      }

      mockMessageServiceInstance.sendMessage.mockResolvedValue(mockSentMessage)

      const { result } = renderHook(() => useMessages('consultation-1'))

      const messageToSend = {
        consultationId: 'consultation-1',
        type: 'text' as const,
        content: '发送的消息',
        sender: 'doctor' as const,
      }

      await act(async () => {
        await result.current.sendMessage(messageToSend)
      })

      expect(mockStoreActions.addMessage).toHaveBeenCalledWith(
        'consultation-1',
        expect.objectContaining({
          content: '发送的消息',
          status: 'sending',
        })
      )

      expect(mockMessageServiceInstance.sendMessage).toHaveBeenCalledWith(
        'consultation-1',
        messageToSend
      )

      expect(mockStoreActions.updateMessage).toHaveBeenCalledWith(
        'consultation-1',
        expect.any(String),
        expect.objectContaining({
          id: 'msg-sent',
          status: 'sent',
        })
      )
    })

    it('should handle send message failure', async () => {
      mockMessageServiceInstance.sendMessage.mockRejectedValue(
        new Error('Send failed')
      )

      const { result } = renderHook(() => useMessages('consultation-1'))

      const messageToSend = {
        consultationId: 'consultation-1',
        type: 'text' as const,
        content: '失败的消息',
        sender: 'doctor' as const,
      }

      await act(async () => {
        try {
          await result.current.sendMessage(messageToSend)
        } catch (error) {
          // Expected to fail
        }
      })

      expect(mockStoreActions.updateMessageStatus).toHaveBeenCalledWith(
        'consultation-1',
        expect.any(String),
        'failed'
      )
    })
  })

  describe('loadMessageHistory', () => {
    it('should load message history successfully', async () => {
      const mockHistory = {
        messages: [
          {
            id: 'msg-history-1',
            consultationId: 'consultation-1',
            type: 'text',
            content: '历史消息1',
            sender: 'patient',
            timestamp: new Date(),
            status: 'delivered',
          } as Message,
        ],
        total: 1,
        page: 1,
        hasMore: false,
      }

      mockMessageServiceInstance.getMessageHistory.mockResolvedValue(
        mockHistory
      )

      const { result } = renderHook(() => useMessages('consultation-1'))

      await act(async () => {
        await result.current.loadMessageHistory(1)
      })

      expect(mockMessageServiceInstance.getMessageHistory).toHaveBeenCalledWith(
        'consultation-1',
        1,
        20
      )

      expect(mockStoreActions.setLoading).toHaveBeenCalledWith(true)
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith(false)
    })

    it('should load more messages and append to existing', async () => {
      const mockHistory = {
        messages: [
          {
            id: 'msg-history-2',
            consultationId: 'consultation-1',
            type: 'text',
            content: '更多历史消息',
            sender: 'patient',
            timestamp: new Date(),
            status: 'delivered',
          } as Message,
        ],
        total: 2,
        page: 2,
        hasMore: false,
      }

      mockMessageServiceInstance.getMessageHistory.mockResolvedValue(
        mockHistory
      )

      const { result } = renderHook(() => useMessages('consultation-1'))

      await act(async () => {
        await result.current.loadMessageHistory(2, true)
      })

      expect(mockMessageServiceInstance.getMessageHistory).toHaveBeenCalledWith(
        'consultation-1',
        2,
        20
      )
    })
  })

  describe('loadMoreMessages', () => {
    it('should load more messages when available', async () => {
      const { result } = renderHook(() => useMessages('consultation-1'))

      // Mock hasMoreMessages to be true
      Object.defineProperty(result.current, 'hasMoreMessages', {
        value: true,
        writable: true,
      })

      const mockHistory = {
        messages: [],
        total: 0,
        page: 2,
        hasMore: false,
      }

      mockMessageServiceInstance.getMessageHistory.mockResolvedValue(
        mockHistory
      )

      await act(async () => {
        await result.current.loadMoreMessages()
      })

      expect(mockMessageServiceInstance.getMessageHistory).toHaveBeenCalled()
    })
  })

  describe('retryMessage', () => {
    it('should retry failed message successfully', async () => {
      const failedMessage: Message = {
        id: 'msg-failed',
        consultationId: 'consultation-1',
        type: 'text',
        content: '失败的消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'failed',
      }

      const retriedMessage: Message = {
        ...failedMessage,
        status: 'sent',
      }

      mockMessageServiceInstance.retryFailedMessage.mockResolvedValue(
        retriedMessage
      )

      const { result } = renderHook(() => useMessages('consultation-1'))

      await act(async () => {
        await result.current.retryMessage(failedMessage)
      })

      expect(mockStoreActions.updateMessageStatus).toHaveBeenCalledWith(
        'consultation-1',
        'msg-failed',
        'sending'
      )

      expect(
        mockMessageServiceInstance.retryFailedMessage
      ).toHaveBeenCalledWith(failedMessage)

      expect(mockStoreActions.updateMessageStatus).toHaveBeenCalledWith(
        'consultation-1',
        'msg-failed',
        'sent'
      )
    })

    it('should handle retry failure', async () => {
      const failedMessage: Message = {
        id: 'msg-failed',
        consultationId: 'consultation-1',
        type: 'text',
        content: '失败的消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'failed',
      }

      mockMessageServiceInstance.retryFailedMessage.mockRejectedValue(
        new Error('Retry failed')
      )

      const { result } = renderHook(() => useMessages('consultation-1'))

      await act(async () => {
        try {
          await result.current.retryMessage(failedMessage)
        } catch (error) {
          // Expected to fail
        }
      })

      expect(mockStoreActions.updateMessageStatus).toHaveBeenCalledWith(
        'consultation-1',
        'msg-failed',
        'failed'
      )
    })
  })

  describe('file operations', () => {
    it('should upload file successfully', async () => {
      const mockFileInfo = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        url: 'https://example.com/test.jpg',
        localPath: '/uploads/test.jpg',
      }

      mockMessageServiceInstance.uploadFile.mockResolvedValue(mockFileInfo)

      const { result } = renderHook(() => useMessages('consultation-1'))

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await act(async () => {
        const result_file = await result.current.uploadFile(file)
        expect(result_file).toEqual(mockFileInfo)
      })

      expect(mockMessageServiceInstance.uploadFile).toHaveBeenCalledWith(file)
    })

    it('should send file message successfully', async () => {
      const mockFileInfo = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        url: 'https://example.com/test.jpg',
        localPath: '/uploads/test.jpg',
      }

      const mockSentMessage: Message = {
        id: 'msg-file',
        consultationId: 'consultation-1',
        type: 'file',
        content: 'test.jpg',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
        fileInfo: mockFileInfo,
      }

      mockMessageServiceInstance.uploadFile.mockResolvedValue(mockFileInfo)
      mockMessageServiceInstance.sendMessage.mockResolvedValue(mockSentMessage)

      const { result } = renderHook(() => useMessages('consultation-1'))

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await act(async () => {
        await result.current.sendFileMessage(file)
      })

      expect(mockMessageServiceInstance.uploadFile).toHaveBeenCalledWith(file)
      expect(mockMessageServiceInstance.sendMessage).toHaveBeenCalledWith(
        'consultation-1',
        expect.objectContaining({
          type: 'file',
          content: 'test.jpg',
          fileInfo: mockFileInfo,
        })
      )
    })
  })

  describe('subscription management', () => {
    it('should subscribe to messages on mount', () => {
      const mockUnsubscribe = vi.fn()
      mockMessageServiceInstance.subscribeToMessages.mockReturnValue(
        mockUnsubscribe
      )

      renderHook(() => useMessages('consultation-1'))

      expect(
        mockMessageServiceInstance.subscribeToMessages
      ).toHaveBeenCalledWith('consultation-1', expect.any(Function))
    })

    it('should unsubscribe on unmount', () => {
      const mockUnsubscribe = vi.fn()
      mockMessageServiceInstance.subscribeToMessages.mockReturnValue(
        mockUnsubscribe
      )

      const { unmount } = renderHook(() => useMessages('consultation-1'))

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should set active chat and mark as read', () => {
      const { result } = renderHook(() => useMessages('consultation-1'))

      act(() => {
        result.current.setActiveChat('consultation-2')
      })

      expect(mockStoreActions.setActiveConversation).toHaveBeenCalledWith(
        'consultation-2'
      )
      expect(mockStoreActions.markAsRead).toHaveBeenCalledWith('consultation-2')
    })
  })

  describe('message statistics', () => {
    it('should return correct message statistics', () => {
      mockUseMessageStore.mockReturnValue({
        ...mockUseMessageStore(),
        conversations: new Map([
          [
            'consultation-1',
            [{ status: 'sent' } as Message, { status: 'failed' } as Message],
          ],
          ['consultation-2', [{ status: 'delivered' } as Message]],
        ]),
        unreadCounts: new Map([
          ['consultation-1', 2],
          ['consultation-2', 1],
        ]),
        sendingMessages: new Set(['msg-1', 'msg-2']),
      })

      const { result } = renderHook(() => useMessages('consultation-1'))

      const stats = result.current.messageStats

      expect(stats.totalUnread).toBe(3)
      expect(stats.totalConversations).toBe(2)
      expect(stats.activeConversations).toBe(2)
      expect(stats.sendingCount).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useMessages('consultation-1'))

      act(() => {
        result.current.clearError()
      })

      expect(mockStoreActions.clearError).toHaveBeenCalled()
    })
  })
})
