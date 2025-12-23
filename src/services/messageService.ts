import type { Message } from '@/types'

export interface MessageList {
  messages: Message[]
  total: number
  page: number
  hasMore: boolean
}

export type MessageCallback = (message: Message) => void

export class MessageService {
  private static instance: MessageService
  private subscribers: Map<string, MessageCallback[]> = new Map()

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService()
    }
    return MessageService.instance
  }

  async sendMessage(
    consultationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'status'>
  ): Promise<Message> {
    try {
      console.log('MessageService.sendMessage called with:', {
        consultationId,
        message,
      })

      const newMessage: Message = {
        ...message,
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        status: 'sending',
      }

      // 模拟发送过程
      await new Promise(resolve => setTimeout(resolve, 500))

      // 更新消息状态为已发送
      const sentMessage: Message = {
        ...newMessage,
        status: 'sent',
      }

      return sentMessage
    } catch (error) {
      console.error('Send message failed:', error)
      throw new Error('发送消息失败')
    }
  }

  async getMessageHistory(
    consultationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<MessageList> {
    try {
      console.log('MessageService.getMessageHistory called with:', {
        consultationId,
        page,
        limit,
      })

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 600))

      // 模拟历史消息数据
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          consultationId,
          type: 'text',
          content: '医生您好，我最近感觉头痛',
          sender: 'patient',
          timestamp: new Date('2024-01-20T10:00:00'),
          status: 'delivered',
        },
        {
          id: 'msg-2',
          consultationId,
          type: 'text',
          content: '您好，请问头痛持续多长时间了？',
          sender: 'doctor',
          timestamp: new Date('2024-01-20T10:02:00'),
          status: 'delivered',
        },
        {
          id: 'msg-3',
          consultationId,
          type: 'text',
          content: '大概有3天了，主要是太阳穴附近疼痛',
          sender: 'patient',
          timestamp: new Date('2024-01-20T10:05:00'),
          status: 'delivered',
        },
      ]

      return {
        messages: mockMessages,
        total: mockMessages.length,
        page,
        hasMore: false,
      }
    } catch (error) {
      console.error('Get message history failed:', error)
      throw new Error('获取消息历史失败')
    }
  }

  subscribeToMessages(
    consultationId: string,
    callback: MessageCallback
  ): () => void {
    console.log(
      'MessageService.subscribeToMessages called for:',
      consultationId
    )

    const callbacks = this.subscribers.get(consultationId) || []
    callbacks.push(callback)
    this.subscribers.set(consultationId, callbacks)

    // 模拟实时消息接收
    const interval = setInterval(() => {
      // 随机发送模拟消息
      if (Math.random() > 0.95) {
        // 5% 概率收到新消息
        const mockMessage: Message = {
          id: `msg-${Date.now()}-${Math.random()}`,
          consultationId,
          type: 'text',
          content: '这是一条模拟的实时消息',
          sender: 'patient',
          timestamp: new Date(),
          status: 'delivered',
        }

        callback(mockMessage)
      }
    }, 2000)

    // 返回取消订阅函数
    return () => {
      clearInterval(interval)
      const callbacks = this.subscribers.get(consultationId) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
        if (callbacks.length === 0) {
          this.subscribers.delete(consultationId)
        } else {
          this.subscribers.set(consultationId, callbacks)
        }
      }
    }
  }

  async uploadFile(file: File): Promise<{ url: string; path: string }> {
    try {
      console.log('MessageService.uploadFile called with:', file.name)

      // 模拟文件上传
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 模拟返回文件信息
      return {
        url: `https://cdn.telemedicine.com/files/${file.name}`,
        path: `/uploads/${Date.now()}-${file.name}`,
      }
    } catch (error) {
      console.error('Upload file failed:', error)
      throw new Error('文件上传失败')
    }
  }

  async markMessageAsRead(
    consultationId: string,
    messageId: string
  ): Promise<void> {
    try {
      console.log('MessageService.markMessageAsRead called with:', {
        consultationId,
        messageId,
      })

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 200))

      // TODO: 实现实际的已读标记逻辑
    } catch (error) {
      console.error('Mark message as read failed:', error)
      // 标记已读失败不应该阻塞用户操作
    }
  }

  async retryFailedMessage(message: Message): Promise<Message> {
    try {
      console.log('MessageService.retryFailedMessage called with:', message.id)

      // 重新发送消息
      const retriedMessage = await this.sendMessage(message.consultationId, {
        type: message.type,
        content: message.content,
        sender: message.sender,
        filePath: message.filePath,
      })

      return retriedMessage
    } catch (error) {
      console.error('Retry failed message failed:', error)
      throw new Error('重发消息失败')
    }
  }
}
