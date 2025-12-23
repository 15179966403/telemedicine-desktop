import { useCallback, useEffect, useRef } from 'react'
import { useMessageStore } from '@/stores'
import { MessageService } from '@/services'
import { useErrorHandler } from '@/utils/errorHandler'
import type { Message } from '@/types'

export function useMessages(consultationId?: string) {
  const {
    conversations,
    activeConversation,
    unreadCounts,
    loading,
    error,
    addMessage,
    updateMessage,
    setActiveConversation,
    markAsRead,
    setLoading,
    clearError,
  } = useMessageStore()

  const { handleAsyncError } = useErrorHandler()
  const messageService = MessageService.getInstance()
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 获取当前对话的消息
  const currentMessages = consultationId
    ? conversations.get(consultationId) || []
    : []

  // 获取当前对话的未读数量
  const currentUnreadCount = consultationId
    ? unreadCounts.get(consultationId) || 0
    : 0

  // 发送消息
  const sendMessage = useCallback(
    async (message: Omit<Message, 'id' | 'timestamp' | 'status'>) => {
      if (!consultationId) return

      return handleAsyncError(async () => {
        // 先添加到本地状态（显示发送中状态）
        const tempMessage: Message = {
          ...message,
          id: `temp-${Date.now()}`,
          timestamp: new Date(),
          status: 'sending',
        }
        addMessage(consultationId, tempMessage)

        try {
          // 发送到服务器
          const sentMessage = await messageService.sendMessage(
            consultationId,
            message
          )

          // 更新消息状态
          updateMessage(consultationId, tempMessage.id, {
            id: sentMessage.id,
            status: sentMessage.status,
          })

          return sentMessage
        } catch (error) {
          // 发送失败，更新状态
          updateMessage(consultationId, tempMessage.id, { status: 'failed' })
          throw error
        }
      })
    },
    [
      consultationId,
      addMessage,
      updateMessage,
      messageService,
      handleAsyncError,
    ]
  )

  // 重发失败的消息
  const retryMessage = useCallback(
    async (message: Message) => {
      if (!consultationId) return

      return handleAsyncError(async () => {
        // 更新为发送中状态
        updateMessage(consultationId, message.id, { status: 'sending' })

        try {
          const retriedMessage =
            await messageService.retryFailedMessage(message)
          updateMessage(consultationId, message.id, {
            id: retriedMessage.id,
            status: retriedMessage.status,
          })
          return retriedMessage
        } catch (error) {
          updateMessage(consultationId, message.id, { status: 'failed' })
          throw error
        }
      })
    },
    [consultationId, updateMessage, messageService, handleAsyncError]
  )

  // 加载历史消息
  const loadMessageHistory = useCallback(
    async (page: number = 1) => {
      if (!consultationId) return

      setLoading(true)
      return handleAsyncError(
        async () => {
          const result = await messageService.getMessageHistory(
            consultationId,
            page
          )

          // 将历史消息添加到对话中（注意不要重复添加）
          const existingMessageIds = new Set(currentMessages.map(m => m.id))
          const newMessages = result.messages.filter(
            m => !existingMessageIds.has(m.id)
          )

          newMessages.forEach(message => {
            addMessage(consultationId, message)
          })

          return result
        },
        { messages: [], total: 0, page: 1, hasMore: false }
      ).finally(() => {
        setLoading(false)
      })
    },
    [
      consultationId,
      messageService,
      addMessage,
      currentMessages,
      setLoading,
      handleAsyncError,
    ]
  )

  // 上传文件
  const uploadFile = useCallback(
    async (file: File) => {
      return handleAsyncError(async () => {
        const result = await messageService.uploadFile(file)
        return result
      })
    },
    [messageService, handleAsyncError]
  )

  // 发送文件消息
  const sendFileMessage = useCallback(
    async (file: File) => {
      if (!consultationId) return

      return handleAsyncError(async () => {
        // 先上传文件
        const fileInfo = await uploadFile(file)

        // 发送文件消息
        const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
          consultationId,
          type: 'file',
          content: file.name,
          sender: 'doctor',
          filePath: fileInfo.path,
        }

        return await sendMessage(message)
      })
    },
    [consultationId, uploadFile, sendMessage, handleAsyncError]
  )

  // 标记消息为已读
  const markMessageAsRead = useCallback(
    async (messageId: string) => {
      if (!consultationId) return

      return handleAsyncError(async () => {
        await messageService.markMessageAsRead(consultationId, messageId)
      })
    },
    [consultationId, messageService, handleAsyncError]
  )

  // 订阅实时消息
  const subscribeToMessages = useCallback(() => {
    if (!consultationId) return

    // 取消之前的订阅
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }

    // 订阅新消息
    unsubscribeRef.current = messageService.subscribeToMessages(
      consultationId,
      (message: Message) => {
        addMessage(consultationId, message)
      }
    )
  }, [consultationId, messageService, addMessage])

  // 取消订阅
  const unsubscribeFromMessages = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }, [])

  // 设置活跃对话
  const setActiveChat = useCallback(
    (newConsultationId: string | null) => {
      setActiveConversation(newConsultationId)

      if (newConsultationId) {
        markAsRead(newConsultationId)
      }
    },
    [setActiveConversation, markAsRead]
  )

  // 获取消息统计
  const getMessageStats = useCallback(() => {
    const totalUnread = Array.from(unreadCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    )
    const totalConversations = conversations.size
    const activeConversations = Array.from(conversations.entries()).filter(
      ([_, messages]) => messages.length > 0
    ).length

    return {
      totalUnread,
      totalConversations,
      activeConversations,
    }
  }, [conversations, unreadCounts])

  // 当 consultationId 变化时，设置为活跃对话并订阅消息
  useEffect(() => {
    if (consultationId) {
      setActiveChat(consultationId)
      subscribeToMessages()

      // 如果没有历史消息，加载一页
      if (currentMessages.length === 0) {
        loadMessageHistory(1)
      }
    }

    return () => {
      unsubscribeFromMessages()
    }
  }, [
    consultationId,
    setActiveChat,
    subscribeToMessages,
    unsubscribeFromMessages,
    loadMessageHistory,
    currentMessages.length,
  ])

  return {
    // 状态
    messages: currentMessages,
    unreadCount: currentUnreadCount,
    loading,
    error,
    isActive: activeConversation === consultationId,

    // 方法
    sendMessage,
    retryMessage,
    loadMessageHistory,
    uploadFile,
    sendFileMessage,
    markMessageAsRead,
    setActiveChat,
    clearError,

    // 订阅管理
    subscribeToMessages,
    unsubscribeFromMessages,

    // 统计信息
    messageStats: getMessageStats(),
  }
}
