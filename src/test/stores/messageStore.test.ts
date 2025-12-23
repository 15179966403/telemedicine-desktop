import { describe, it, expect, beforeEach } from 'vitest'
import { useMessageStore } from '@/stores/messageStore'
import type { Message } from '@/types'

describe('MessageStore', () => {
  const mockMessage1: Message = {
    id: '1',
    consultationId: 'consultation-1',
    type: 'text',
    content: '您好，我想咨询一下',
    sender: 'patient',
    timestamp: new Date('2024-01-15T10:00:00'),
    status: 'sent',
  }

  const mockMessage2: Message = {
    id: '2',
    consultationId: 'consultation-1',
    type: 'text',
    content: '您好，请描述一下症状',
    sender: 'doctor',
    timestamp: new Date('2024-01-15T10:01:00'),
    status: 'sent',
  }

  const mockMessage3: Message = {
    id: '3',
    consultationId: 'consultation-2',
    type: 'text',
    content: '复诊预约',
    sender: 'patient',
    timestamp: new Date('2024-01-15T11:00:00'),
    status: 'sent',
  }

  beforeEach(() => {
    // Reset store state
    useMessageStore.setState({
      conversations: new Map(),
      activeConversation: null,
      unreadCounts: new Map(),
      loading: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useMessageStore.getState()

      expect(state.conversations).toBeInstanceOf(Map)
      expect(state.conversations.size).toBe(0)
      expect(state.activeConversation).toBeNull()
      expect(state.unreadCounts).toBeInstanceOf(Map)
      expect(state.unreadCounts.size).toBe(0)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Conversation Management', () => {
    it('should set conversations', () => {
      const conversations = new Map([
        ['consultation-1', [mockMessage1, mockMessage2]],
        ['consultation-2', [mockMessage3]],
      ])

      const { setConversations } = useMessageStore.getState()
      setConversations(conversations)

      const state = useMessageStore.getState()
      expect(state.conversations.size).toBe(2)
      expect(state.conversations.get('consultation-1')).toEqual([
        mockMessage1,
        mockMessage2,
      ])
      expect(state.conversations.get('consultation-2')).toEqual([mockMessage3])
    })

    it('should add message to existing conversation', () => {
      const existingConversations = new Map([
        ['consultation-1', [mockMessage1]],
      ])
      useMessageStore.setState({ conversations: existingConversations })

      const { addMessage } = useMessageStore.getState()
      addMessage('consultation-1', mockMessage2)

      const state = useMessageStore.getState()
      const messages = state.conversations.get('consultation-1')
      expect(messages).toHaveLength(2)
      expect(messages?.[1]).toEqual(mockMessage2)
    })

    it('should add message to new conversation', () => {
      const { addMessage } = useMessageStore.getState()
      addMessage('consultation-1', mockMessage1)

      const state = useMessageStore.getState()
      const messages = state.conversations.get('consultation-1')
      expect(messages).toHaveLength(1)
      expect(messages?.[0]).toEqual(mockMessage1)
    })

    it('should increment unread count for patient messages in inactive conversation', () => {
      useMessageStore.setState({ activeConversation: 'consultation-2' })

      const { addMessage } = useMessageStore.getState()
      addMessage('consultation-1', mockMessage1) // patient message to inactive conversation

      const state = useMessageStore.getState()
      expect(state.unreadCounts.get('consultation-1')).toBe(1)
    })

    it('should not increment unread count for doctor messages', () => {
      useMessageStore.setState({ activeConversation: 'consultation-2' })

      const { addMessage } = useMessageStore.getState()
      addMessage('consultation-1', mockMessage2) // doctor message

      const state = useMessageStore.getState()
      expect(state.unreadCounts.get('consultation-1')).toBeUndefined()
    })

    it('should not increment unread count for active conversation', () => {
      useMessageStore.setState({ activeConversation: 'consultation-1' })

      const { addMessage } = useMessageStore.getState()
      addMessage('consultation-1', mockMessage1) // patient message to active conversation

      const state = useMessageStore.getState()
      expect(state.unreadCounts.get('consultation-1')).toBeUndefined()
    })
  })

  describe('Message Updates', () => {
    beforeEach(() => {
      const conversations = new Map([
        ['consultation-1', [mockMessage1, mockMessage2]],
      ])
      useMessageStore.setState({ conversations })
    })

    it('should update message', () => {
      const updates = {
        status: 'delivered' as const,
        content: 'Updated content',
      }

      const { updateMessage } = useMessageStore.getState()
      updateMessage('consultation-1', mockMessage1.id, updates)

      const state = useMessageStore.getState()
      const messages = state.conversations.get('consultation-1')
      const updatedMessage = messages?.find(m => m.id === mockMessage1.id)

      expect(updatedMessage?.status).toBe('delivered')
      expect(updatedMessage?.content).toBe('Updated content')
      expect(updatedMessage?.sender).toBe(mockMessage1.sender) // unchanged
    })

    it('should not affect other messages when updating', () => {
      const updates = { content: 'Updated content' }

      const { updateMessage } = useMessageStore.getState()
      updateMessage('consultation-1', mockMessage1.id, updates)

      const state = useMessageStore.getState()
      const messages = state.conversations.get('consultation-1')
      const otherMessage = messages?.find(m => m.id === mockMessage2.id)

      expect(otherMessage).toEqual(mockMessage2) // unchanged
    })

    it('should handle update for non-existent message', () => {
      const { updateMessage } = useMessageStore.getState()
      updateMessage('consultation-1', 'non-existent', { content: 'test' })

      // Should not throw error and should not change existing messages
      const state = useMessageStore.getState()
      const messages = state.conversations.get('consultation-1')
      expect(messages).toHaveLength(2)
    })
  })

  describe('Active Conversation Management', () => {
    beforeEach(() => {
      const unreadCounts = new Map([
        ['consultation-1', 3],
        ['consultation-2', 1],
      ])
      useMessageStore.setState({ unreadCounts })
    })

    it('should set active conversation', () => {
      const { setActiveConversation } = useMessageStore.getState()
      setActiveConversation('consultation-1')

      expect(useMessageStore.getState().activeConversation).toBe(
        'consultation-1'
      )
    })

    it('should mark conversation as read when setting as active', () => {
      const { setActiveConversation } = useMessageStore.getState()
      setActiveConversation('consultation-1')

      const state = useMessageStore.getState()
      expect(state.unreadCounts.get('consultation-1')).toBe(0)
      expect(state.unreadCounts.get('consultation-2')).toBe(1) // unchanged
    })

    it('should clear active conversation', () => {
      useMessageStore.setState({ activeConversation: 'consultation-1' })

      const { setActiveConversation } = useMessageStore.getState()
      setActiveConversation(null)

      expect(useMessageStore.getState().activeConversation).toBeNull()
    })
  })

  describe('Unread Count Management', () => {
    it('should mark conversation as read', () => {
      const unreadCounts = new Map([
        ['consultation-1', 5],
        ['consultation-2', 2],
      ])
      useMessageStore.setState({ unreadCounts })

      const { markAsRead } = useMessageStore.getState()
      markAsRead('consultation-1')

      const state = useMessageStore.getState()
      expect(state.unreadCounts.get('consultation-1')).toBe(0)
      expect(state.unreadCounts.get('consultation-2')).toBe(2) // unchanged
    })

    it('should increment unread count', () => {
      const unreadCounts = new Map([['consultation-1', 2]])
      useMessageStore.setState({ unreadCounts })

      const { incrementUnreadCount } = useMessageStore.getState()
      incrementUnreadCount('consultation-1')

      expect(
        useMessageStore.getState().unreadCounts.get('consultation-1')
      ).toBe(3)
    })

    it('should increment unread count for new conversation', () => {
      const { incrementUnreadCount } = useMessageStore.getState()
      incrementUnreadCount('consultation-new')

      expect(
        useMessageStore.getState().unreadCounts.get('consultation-new')
      ).toBe(1)
    })
  })

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useMessageStore.getState()
      setLoading(true)

      expect(useMessageStore.getState().loading).toBe(true)

      setLoading(false)
      expect(useMessageStore.getState().loading).toBe(false)
    })

    it('should set error', () => {
      const errorMessage = '消息发送失败'

      const { setError } = useMessageStore.getState()
      setError(errorMessage)

      expect(useMessageStore.getState().error).toBe(errorMessage)
    })

    it('should clear error', () => {
      useMessageStore.setState({ error: 'Some error' })

      const { clearError } = useMessageStore.getState()
      clearError()

      expect(useMessageStore.getState().error).toBeNull()
    })
  })
})
