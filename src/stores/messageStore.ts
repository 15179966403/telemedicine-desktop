import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type {
  Message,
  Consultation,
  MessageStatus,
  ConnectionStatus,
} from '@/types'

interface MessageState {
  conversations: Map<string, Message[]>
  consultations: Consultation[]
  activeConversation: string | null
  unreadCounts: Map<string, number>
  loading: boolean
  error: string | null
  connectionStatus: ConnectionStatus
  sendingMessages: Set<string> // 正在发送的消息ID
}

interface MessageActions {
  setConversations: (conversations: Map<string, Message[]>) => void
  addMessage: (consultationId: string, message: Message) => void
  updateMessage: (
    consultationId: string,
    messageId: string,
    updates: Partial<Message>
  ) => void
  updateMessageStatus: (
    consultationId: string,
    messageId: string,
    status: MessageStatus
  ) => void
  setActiveConversation: (consultationId: string | null) => void
  markAsRead: (consultationId: string) => void
  incrementUnreadCount: (consultationId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  setConnectionStatus: (status: ConnectionStatus) => void
  addSendingMessage: (messageId: string) => void
  removeSendingMessage: (messageId: string) => void
  retryFailedMessages: (consultationId: string) => Promise<void>
  syncMessages: (consultationId: string) => Promise<void>
}

export const useMessageStore = create<MessageState & MessageActions>(
  (set, get) => ({
    // State
    conversations: new Map(),
    consultations: [],
    activeConversation: null,
    unreadCounts: new Map(),
    loading: false,
    error: null,
    connectionStatus: 'connected',
    sendingMessages: new Set(),

    // Actions
    setConversations: (conversations: Map<string, Message[]>) => {
      set({ conversations })
    },

    addMessage: (consultationId: string, message: Message) => {
      const { conversations } = get()
      const newConversations = new Map(conversations)
      const existingMessages = newConversations.get(consultationId) || []

      // 检查消息是否已存在（避免重复添加）
      const messageExists = existingMessages.some(m => m.id === message.id)
      if (!messageExists) {
        newConversations.set(consultationId, [...existingMessages, message])
        set({ conversations: newConversations })

        // 如果不是当前活跃的对话，增加未读计数
        const { activeConversation } = get()
        if (
          activeConversation !== consultationId &&
          message.sender === 'patient'
        ) {
          get().incrementUnreadCount(consultationId)
        }
      }
    },

    updateMessage: (
      consultationId: string,
      messageId: string,
      updates: Partial<Message>
    ) => {
      const { conversations } = get()
      const newConversations = new Map(conversations)
      const messages = newConversations.get(consultationId) || []
      const updatedMessages = messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
      newConversations.set(consultationId, updatedMessages)
      set({ conversations: newConversations })
    },

    updateMessageStatus: (
      consultationId: string,
      messageId: string,
      status: MessageStatus
    ) => {
      get().updateMessage(consultationId, messageId, { status })

      // 如果消息发送完成，从发送中列表移除
      if (status !== 'sending') {
        get().removeSendingMessage(messageId)
      }
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

      // 调用后端标记消息为已读
      invoke('mark_messages_as_read', { consultationId }).catch(error =>
        console.error('Failed to mark messages as read:', error)
      )
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

    setConnectionStatus: (status: ConnectionStatus) => {
      set({ connectionStatus: status })
    },

    addSendingMessage: (messageId: string) => {
      const { sendingMessages } = get()
      const newSendingMessages = new Set(sendingMessages)
      newSendingMessages.add(messageId)
      set({ sendingMessages: newSendingMessages })
    },

    removeSendingMessage: (messageId: string) => {
      const { sendingMessages } = get()
      const newSendingMessages = new Set(sendingMessages)
      newSendingMessages.delete(messageId)
      set({ sendingMessages: newSendingMessages })
    },

    // 重试失败的消息
    retryFailedMessages: async (consultationId: string) => {
      const { conversations } = get()
      const messages = conversations.get(consultationId) || []
      const failedMessages = messages.filter(
        msg => msg.status === 'failed' && msg.sender === 'doctor'
      )

      for (const message of failedMessages) {
        try {
          // 更新状态为发送中
          get().updateMessageStatus(consultationId, message.id, 'sending')
          get().addSendingMessage(message.id)

          // 重新发送消息
          const request = {
            consultationId: message.consultationId,
            messageType: message.type,
            content: message.content,
            sender: message.sender,
            filePath: message.fileInfo?.localPath,
          }

          const result = await invoke<any>('send_message', { request })

          // 更新消息状态
          get().updateMessageStatus(consultationId, message.id, 'sent')
        } catch (error) {
          console.error('Failed to retry message:', error)
          get().updateMessageStatus(consultationId, message.id, 'failed')
        }
      }
    },

    // 同步消息
    syncMessages: async (consultationId: string) => {
      try {
        set({ loading: true })

        // 同步待发送的消息
        await invoke('sync_pending_messages')

        // 重新加载消息历史
        const result = await invoke<any>('get_message_history', {
          consultationId,
          page: 1,
          limit: 50,
        })

        // 更新本地消息
        const messages: Message[] = result.messages.map((msg: any) => ({
          id: msg.id,
          consultationId: msg.consultation_id,
          type: msg.message_type as Message['type'],
          content: msg.content,
          sender: msg.sender as Message['sender'],
          timestamp: new Date(msg.timestamp),
          status: msg.status as Message['status'],
          fileInfo: msg.file_path
            ? {
                id: msg.id,
                name: msg.content,
                size: 0,
                type: '',
                url: msg.file_path,
                localPath: msg.file_path,
              }
            : undefined,
        }))

        const { conversations } = get()
        const newConversations = new Map(conversations)
        newConversations.set(consultationId, messages)
        set({ conversations: newConversations })
      } catch (error) {
        console.error('Failed to sync messages:', error)
        set({ error: '同步消息失败' })
      } finally {
        set({ loading: false })
      }
    },
  })
)
