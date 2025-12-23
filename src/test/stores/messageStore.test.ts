import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMessageStore } from '@/stores/messageStore'
import { invoke } from '@tauri-apps/api/core'
import type { Message } from '@/types'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

const mockInvoke = vi.mocked(invoke)

describe('MessageStore', () => {
  beforeEach(() => {
    // Reset store state
    useMessageStore.setState({
      conversations: new Map(),
      consultations: [],
      activeConversation: null,
      unreadCounts: new Map(),
      loading: false,
      error: null,
      connectionStatus: 'connected',
      sendingMessages: new Set(),
    })
    vi.clearAllMocks()
  })

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      const { addMessage, conversations } = useMessageStore.getState()

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      }

      addMessage('consultation-1', message)

      const updatedConversations = useMessageStore.getState().conversations
      const messages = updatedConversations.get('consultation-1')

      expect(messages).toHaveLength(1)
      expect(messages?.[0]).toEqual(message)
    })

    it('should not add duplicate messages', () => {
      const { addMessage } = useMessageStore.getState()

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      }

      // Add same message twice
      addMessage('consultation-1', message)
      addMessage('consultation-1', message)

      const conversations = useMessageStore.getState().conversations
      const messages = conversations.get('consultation-1')

      expect(messages).toHaveLength(1)
    })

    it('should increment unread count for patient messages when not active', () => {
      const { addMessage, setActiveConversation } = useMessageStore.getState()

      // Set different active conversation
      setActiveConversation('consultation-2')

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '患者消息',
        sender: 'patient',
        timestamp: new Date(),
        status: 'delivered',
      }

      addMessage('consultation-1', message)

      const unreadCounts = useMessageStore.getState().unreadCounts
      expect(unreadCounts.get('consultation-1')).toBe(1)
    })

    it('should not increment unread count for doctor messages', () => {
      const { addMessage, setActiveConversation } = useMessageStore.getState()

      // Set different active conversation
      setActiveConversation('consultation-2')

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '医生消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sent',
      }

      addMessage('consultation-1', message)

      const unreadCounts = useMessageStore.getState().unreadCounts
      expect(unreadCounts.get('consultation-1')).toBe(0)
    })
  })

  describe('updateMessage', () => {
    it('should update existing message', () => {
      const { addMessage, updateMessage } = useMessageStore.getState()

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '原始消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sending',
      }

      addMessage('consultation-1', message)
      updateMessage('consultation-1', 'msg-1', {
        status: 'sent',
        content: '更新后的消息',
      })

      const conversations = useMessageStore.getState().conversations
      const messages = conversations.get('consultation-1')
      const updatedMessage = messages?.[0]

      expect(updatedMessage?.status).toBe('sent')
      expect(updatedMessage?.content).toBe('更新后的消息')
    })

    it('should not update non-existent message', () => {
      const { updateMessage } = useMessageStore.getState()

      updateMessage('consultation-1', 'non-existent', { status: 'sent' })

      const conversations = useMessageStore.getState().conversations
      const messages = conversations.get('consultation-1')

      expect(messages || []).toHaveLength(0)
    })
  })

  describe('updateMessageStatus', () => {
    it('should update message status and remove from sending list', () => {
      const { addMessage, updateMessageStatus, addSendingMessage } =
        useMessageStore.getState()

      const message: Message = {
        id: 'msg-1',
        consultationId: 'consultation-1',
        type: 'text',
        content: '测试消息',
        sender: 'doctor',
        timestamp: new Date(),
        status: 'sending',
      }

      addMessage('consultation-1', message)
      addSendingMessage('msg-1')

      // Verify message is in sending list
      expect(useMessageStore.getState().sendingMessages.has('msg-1')).toBe(true)

      updateMessageStatus('consultation-1', 'msg-1', 'sent')

      const conversations = useMessageStore.getState().conversations
      const messages = conversations.get('consultation-1')
      const updatedMessage = messages?.[0]

      expect(updatedMessage?.status).toBe('sent')
      expect(useMessageStore.getState().sendingMessages.has('msg-1')).toBe(
        false
      )
    })
  })

  describe('setActiveConversation', () => {
    it('should set active conversation and mark as read', () => {
      const { setActiveConversation, incrementUnreadCount } =
        useMessageStore.getState()

      // Add some unread messages
      incrementUnreadCount('consultation-1')
      incrementUnreadCount('consultation-1')

      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(2)

      setActiveConversation('consultation-1')

      expect(useMessageStore.getState().activeConversation).toBe(
        'consultation-1'
      )
      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(0)
    })

    it('should call backend to mark messages as read', () => {
      const { setActiveConversation } = useMessageStore.getState()

      setActiveConversation('consultation-1')

      expect(mockInvoke).toHaveBeenCalledWith('mark_messages_as_read', {
        consultationId: 'consultation-1',
      })
    })
  })

  describe('markAsRead', () => {
    it('should reset unread count to zero', () => {
      const { markAsRead, incrementUnreadCount } = useMessageStore.getState()

      // Add some unread messages
      incrementUnreadCount('consultation-1')
      incrementUnreadCount('consultation-1')
      incrementUnreadCount('consultation-1')

      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(3)

      markAsRead('consultation-1')

      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(0)
    })
  })

  describe('incrementUnreadCount', () => {
    it('should increment unread count', () => {
      const { incrementUnreadCount } = useMessageStore.getState()

      incrementUnreadCount('consultation-1')
      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(1)

      incrementUnreadCount('consultation-1')
      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(2)
    })

    it('should start from 0 for new conversations', () => {
      const { incrementUnreadCount } = useMessageStore.getState()

      incrementUnreadCount('new-consultation')
      expect(
        useMessageStore.getState().unreadCounts.get('new-consultation')
      ).toBe(1)
    })
  })

  describe('sendingMessages', () => {
    it('should add and remove sending messages', () => {
      const { addSendingMessage, removeSendingMessage } =
        useMessageStore.getState()

      addSendingMessage('msg-1')
      expect(useMessageStore.getState().sendingMessages.has('msg-1')).toBe(true)

      addSendingMessage('msg-2')
      expect(useMessageStore.getState().sendingMessages.size).toBe(2)

      removeSendingMessage('msg-1')
      expect(useMessageStore.getState().sendingMessages.has('msg-1')).toBe(
        false
      )
      expect(useMessageStore.getState().sendingMessages.has('msg-2')).toBe(true)
      expect(useMessageStore.getState().sendingMessages.size).toBe(1)
    })
  })

  describe('retryFailedMessages', () => {
    it('should retry all failed messages in a conversation', async () => {
      const { addMessage, retryFailedMessages } = useMessageStore.getState()

      // Add some messages including failed ones
      const messages: Message[] = [
        {
          id: 'msg-1',
          consultationId: 'consultation-1',
          type: 'text',
          content: '成功消息',
          sender: 'doctor',
          timestamp: new Date(),
          status: 'sent',
        },
        {
          id: 'msg-2',
          consultationId: 'consultation-1',
          type: 'text',
          content: '失败消息1',
          sender: 'doctor',
          timestamp: new Date(),
          status: 'failed',
        },
        {
          id: 'msg-3',
          consultationId: 'consultation-1',
          type: 'text',
          content: '失败消息2',
          sender: 'doctor',
          timestamp: new Date(),
          status: 'failed',
        },
        {
          id: 'msg-4',
          consultationId: 'consultation-1',
          type: 'text',
          content: '患者消息',
          sender: 'patient',
          timestamp: new Date(),
          status: 'failed', // This should not be retried
        },
      ]

      messages.forEach(msg => addMessage('consultation-1', msg))

      // Mock successful retry
      mockInvoke.mockResolvedValue({
        id: 'new-id',
        consultation_id: 'consultation-1',
        message_type: 'text',
        content: 'retried',
        sender: 'doctor',
        timestamp: new Date().toISOString(),
        status: 'sent',
      })

      await retryFailedMessages('consultation-1')

      // Should only retry doctor's failed messages (2 calls)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncMessages', () => {
    it('should sync messages and update conversations', async () => {
      const { syncMessages } = useMessageStore.getState()

      const mockSyncResponse = {
        messages: [
          {
            id: 'msg-1',
            consultation_id: 'consultation-1',
            message_type: 'text',
            content: '同步消息1',
            sender: 'patient',
            timestamp: new Date().toISOString(),
            status: 'delivered',
          },
          {
            id: 'msg-2',
            consultation_id: 'consultation-1',
            message_type: 'text',
            content: '同步消息2',
            sender: 'doctor',
            timestamp: new Date().toISOString(),
            status: 'sent',
          },
        ],
        total: 2,
        page: 1,
        has_more: false,
      }

      mockInvoke
        .mockResolvedValueOnce(2) // sync_pending_messages returns count
        .mockResolvedValueOnce(mockSyncResponse) // get_message_history returns messages

      await syncMessages('consultation-1')

      expect(mockInvoke).toHaveBeenCalledWith('sync_pending_messages')
      expect(mockInvoke).toHaveBeenCalledWith('get_message_history', {
        consultationId: 'consultation-1',
        page: 1,
        limit: 50,
      })

      const conversations = useMessageStore.getState().conversations
      const messages = conversations.get('consultation-1')

      expect(messages).toHaveLength(2)
      expect(messages?.[0].content).toBe('同步消息1')
      expect(messages?.[1].content).toBe('同步消息2')
    })

    it('should handle sync errors', async () => {
      const { syncMessages } = useMessageStore.getState()

      mockInvoke.mockRejectedValue(new Error('Sync failed'))

      await syncMessages('consultation-1')

      expect(useMessageStore.getState().error).toBe('同步消息失败')
    })
  })

  describe('error handling', () => {
    it('should set and clear errors', () => {
      const { setError, clearError } = useMessageStore.getState()

      setError('测试错误')
      expect(useMessageStore.getState().error).toBe('测试错误')

      clearError()
      expect(useMessageStore.getState().error).toBeNull()
    })
  })

  describe('loading states', () => {
    it('should set loading state', () => {
      const { setLoading } = useMessageStore.getState()

      setLoading(true)
      expect(useMessageStore.getState().loading).toBe(true)

      setLoading(false)
      expect(useMessageStore.getState().loading).toBe(false)
    })
  })

  describe('connection status', () => {
    it('should set connection status', () => {
      const { setConnectionStatus } = useMessageStore.getState()

      setConnectionStatus('disconnected')
      expect(useMessageStore.getState().connectionStatus).toBe('disconnected')

      setConnectionStatus('reconnecting')
      expect(useMessageStore.getState().connectionStatus).toBe('reconnecting')

      setConnectionStatus('connected')
      expect(useMessageStore.getState().connectionStatus).toBe('connected')
    })
  })
})
