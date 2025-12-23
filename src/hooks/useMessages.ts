import { useCallback, useEffect, useRef, useState } from 'react'
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
    connectionStatus,
    sendingMessages,
    addMessage,
    updateMessage,
    updateMessageStatus,
    setActiveConversation,
    markAsRead,
    setLoading,
    clearError,
    addSendingMessage,
    removeSendingMessage,
    retryFailedMessages,
    syncMessages,
  } = useMessageStore()

  const { handleAsyncError } = useErrorHandler()
  const messageService = MessageService.getInstance()
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

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
        // 生成临时消息ID
        const tempId = `temp-${Date.now()}-${Math.random()}`

        // 先添加到本地状态（显示发送中状态）
        const tempMessage: Message = {
          ...message,
          id: tempId,
          timestamp: new Date(),
          status: 'sending',
        }

        addMessage(consultationId, tempMessage)
        addSendingMessage(tempId)

        try {
          // 发送到服务器
          const sentMessage = await messageService.sendMessage(
            consultationId,
            message
          )

          // 更新消息ID和状态
          updateMessage(consultationId, tempId, {
            id: sentMessage.id,
            status: sentMessage.status,
            timestamp: sentMessage.timestamp,
          })

          return sentMessage
        } catch (error) {
          // 发送失败，更新状态
          updateMessageStatus(consultationId, tempId, 'failed')
          throw error
        }
      })
    },
    [
      consultationId,
      addMessage,
      updateMessage,
      updateMessageStatus,
      addSendingMessage,
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
        updateMessageStatus(consultationId, message.id, 'sending')
        addSendingMessage(message.id)

        try {
          const retriedMessage =
            await messageService.retryFailedMessage(message)
          updateMessageStatus(consultationId, message.id, retriedMessage.status)
          return retriedMessage
        } catch (error) {
          updateMessageStatus(consultationId, message.id, 'failed')
          throw error
        }
      })
    },
    [
      consultationId,
      updateMessageStatus,
      addSendingMessage,
      messageService,
      handleAsyncError,
    ]
  )

  // 加载历史消息（支持分页）
  const loadMessageHistory = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (!consultationId) return

      if (!append) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      return handleAsyncError(
        async () => {
          const result = await messageService.getMessageHistory(
            consultationId,
            page,
            20 // 每页20条消息
          )

          if (append) {
            // 追加到现有消息
            const existingMessageIds = new Set(currentMessages.map(m => m.id))
            const newMessages = result.messages.filter(
              m => !existingMessageIds.has(m.id)
            )

            // 将新消息插入到开头（历史消息应该在前面）
            const { conversations } = useMessageStore.getState()
            const existingMessages = conversations.get(consultationId) || []
            const updatedMessages = [...newMessages, ...existingMessages]

            const newConversations = new Map(conversations)
            newConversations.set(consultationId, updatedMessages)
            useMessageStore.setState({ conversations: newConversations })
          } else {
            // 替换所有消息
            result.messages.forEach(message => {
              addMessage(consultationId, message)
            })
          }

          // 更新分页状态
          setHasMoreMessages(result.hasMore)
          if (append) {
            setCurrentPage(page)
          } else {
            setCurrentPage(1)
          }

          return result
        },
        { messages: [], total: 0, page: 1, hasMore: false }
      ).finally(() => {
        setLoading(false)
        setLoadingMore(false)
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

  // 加载更多历史消息
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore) return

    const nextPage = currentPage + 1
    await loadMessageHistory(nextPage, true)
  }, [currentPage, hasMoreMessages, loadingMore, loadMessageHistory])

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
          fileInfo,
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

  // 重试所有失败的消息
  const retryAllFailedMessages = useCallback(async () => {
    if (!consultationId) return
    await retryFailedMessages(consultationId)
  }, [consultationId, retryFailedMessages])

  // 同步消息
  const syncAllMessages = useCallback(async () => {
    if (!consultationId) return
    await syncMessages(consultationId)
  }, [consultationId, syncMessages])

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

    const failedMessages = currentMessages.filter(
      m => m.status === 'failed'
    ).length
    const sendingCount = sendingMessages.size

    return {
      totalUnread,
      totalConversations,
      activeConversations,
      failedMessages,
      sendingCount,
      hasMoreMessages,
      currentPage,
    }
  }, [
    conversations,
    unreadCounts,
    currentMessages,
    sendingMessages,
    hasMoreMessages,
    currentPage,
  ])

  // 当 consultationId 变化时，设置为活跃对话并订阅消息
  useEffect(() => {
    if (consultationId) {
      setActiveChat(consultationId)
      subscribeToMessages()

      // 如果没有历史消息，加载第一页
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
    loadingMore,
    error,
    isActive: activeConversation === consultationId,
    connectionStatus,
    hasMoreMessages,
    currentPage,

    // 方法
    sendMessage,
    retryMessage,
    loadMessageHistory,
    loadMoreMessages,
    uploadFile,
    sendFileMessage,
    markMessageAsRead,
    setActiveChat,
    clearError,
    retryAllFailedMessages,
    syncAllMessages,

    // 订阅管理
    subscribeToMessages,
    unsubscribeFromMessages,

    // 统计信息
    messageStats: getMessageStats(),
  }
}
