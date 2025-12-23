import { create } from 'zustand'
import type { Message } from '@/types'

interface MessageState {
  conversations: Map<string, Message[]>
  activeConversation: string | null
  unreadCounts: Map<string, number>
  loading: boolean
  error: string | null
}

interface MessageActions {
  setConversations: (conversations: Map<string, Message[]>) => void
  addMessage: (consultationId: string, message: Message) => void
  updateMessage: (consultationId: string, messageId: string, updates: Partial<Message>) => void
  setActiveConversation: (consultationId: string | null) => void
  markAsRead: (consultationId: string) => void
  incrementUnreadCount: (consultationId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  // State
  conversations: new Map(),
  activeConversation: null,
  unreadCounts: new Map(),
  loading: false,
  error: null,

  // Actions
  setConversations: (conversations: Map<string, Message[]>) => {
    set({ conversations })
  },

  addMessage: (consultationId: string, message: Message) => {
    const { conversations } = get()
    const newConversations = new Map(conversations)
    const existingMessages = newConversations.get(consultationId) || []
    newConversations.set(consultationId, [...existingMessages, message])
    set({ conversations: newConversations })

    // 如果不是当前活跃的对话，增加未读计数
    const { activeConversation } = get()
    if (activeConversation !== consultationId && message.sender === 'patient') {
      get().incrementUnreadCount(consultationId)
    }
  },

  updateMessage: (consultationId: string, messageId: string, updates: Partial<Message>) => {
    const { conversations } = get()
    const newConversations = new Map(conversations)
    const messages = newConversations.get(consultationId) || []
    const updatedMessages = messages.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    )
    newConversations.set(consultationId, updatedMessages)
    set({ conversations: newConversations })
  },

  setActiveConversation: (consultationId: string | null) => {
    set({ activeConversation: consultationId })

    // 标记当前对话为已读
    if (consultationId) {
      get().markAsRead(consultationId)
    }
  },

  markAsRead: (consultationId: string) => {
    const { unreadCounts } = get()
    const newUnreadCounts = new Map(unreadCounts)
    newUnreadCounts.set(consultationId, 0)
    set({ unreadCounts: newUnreadCounts })
  },

  incrementUnreadCount: (consultationId: string) => {
    const { unreadCounts } = get()
    const newUnreadCounts = new Map(unreadCounts)
    const currentCount = newUnreadCounts.get(consultationId) || 0
    newUnreadCounts.set(consultationId, currentCount + 1)
    set({ unreadCounts: newUnreadCounts })
  },

  setLoading: (loading: boolean) => {
    set({ loading })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },
}))