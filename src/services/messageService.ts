import { invoke } from '@tauri-apps/api/core'
import { webSocketService } from './webSocketService'
import type {
  Message,
  MessageList,
  SendMessageRequest,
  FileInfo,
} from '@/types'

export type MessageCallback = (message: Message) => void

export class MessageService {
  private static instance: MessageService
  private subscribers: Map<string, MessageCallback[]> = new Map()
  private messageQueue: Map<string, SendMessageRequest[]> = new Map()
  private isOnline: boolean = true
  private webSocketConnectionId: string | null = null

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService()
    }
    return MessageService.instance
  }

  // 初始化 WebSocket 连接
  async initializeWebSocket(url: string, authToken?: string): Promise<void> {
    try {
      await webSocketService.initialize()

      this.webSocketConnectionId = await webSocketService.createConnection({
        url,
        authToken,
        autoReconnect: true,
        reconnectAttempts: 5,
        reconnectDelay: 2000,
      })

      console.log(
        'WebSocket connection initialized:',
        this.webSocketConnectionId
      )
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
      throw error
    }
  }

  // 获取 WebSocket 连接状态
  getWebSocketStatus(): string {
    if (!this.webSocketConnectionId) return 'disconnected'
    return webSocketService.getConnectionStatus(this.webSocketConnectionId)
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

      // 优先使用 WebSocket 发送
      if (this.webSocketConnectionId && this.isOnline) {
        try {
          await webSocketService.sendMessage(
            this.webSocketConnectionId,
            consultationId,
            message
          )

          // 构建返回的消息对象
          const sentMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            consultationId,
            type: message.type,
            content: message.content,
            sender: message.sender,
            timestamp: new Date(),
            status: 'sent',
            fileInfo: message.fileInfo,
          }

          return sentMessage
        } catch (wsError) {
          console.warn('WebSocket send failed, falling back to Tauri:', wsError)
        }
      }

      // 构建发送请求
      const request: SendMessageRequest = {
        consultationId,
        type: message.type,
        content: message.content,
        fileId: message.fileInfo?.id,
      }

      // 如果离线，添加到队列
      if (!this.isOnline) {
        this.addToQueue(consultationId, request)
        throw new Error('网络连接异常，消息已加入发送队列')
      }

      // 调用 Tauri 命令发送消息
      const result = await invoke<any>('send_message', { request })

      // 转换返回的消息格式
      const sentMessage: Message = {
        id: result.id,
        consultationId: result.consultation_id,
        type: result.message_type as Message['type'],
        content: result.content,
        sender: result.sender as Message['sender'],
        timestamp: new Date(result.timestamp),
        status: result.status as Message['status'],
        fileInfo: result.file_path
          ? {
              id: result.id,
              name: message.content,
              size: 0,
              type: '',
              url: result.file_path,
              localPath: result.file_path,
            }
          : undefined,
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

      // 调用 Tauri 命令获取消息历史
      const result = await invoke<any>('get_message_history', {
        consultationId,
        page,
        limit,
      })

      // 转换消息格式
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

      return {
        messages,
        total: result.total,
        page: result.page,
        hasMore: result.has_more,
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

    // 优先使用 WebSocket 订阅
    let webSocketUnsubscribe: (() => void) | null = null
    if (this.webSocketConnectionId) {
      webSocketService
        .subscribeToConsultation(
          this.webSocketConnectionId,
          consultationId,
          callback
        )
        .then(unsubscribe => {
          webSocketUnsubscribe = unsubscribe
        })
        .catch(error => {
          console.warn('WebSocket subscription failed:', error)
        })
    }

    // 模拟实时消息接收（备用机制）
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

      // 取消 WebSocket 订阅
      if (webSocketUnsubscribe) {
        webSocketUnsubscribe()
      }

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

  async uploadFile(file: File): Promise<FileInfo> {
    try {
      console.log('MessageService.uploadFile called with:', file.name)

      // 将文件转换为字节数组
      const arrayBuffer = await file.arrayBuffer()
      const fileData = Array.from(new Uint8Array(arrayBuffer))

      // 调用 Tauri 命令上传文件
      const result = await invoke<any>('upload_file', {
        fileData,
        fileName: file.name,
      })

      return {
        id: `file-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.url,
        localPath: result.path,
      }
    } catch (error) {
      console.error('Upload file failed:', error)
      throw new Error('文件上传失败')
    }
  }

  // 发送已读回执
  async sendReadReceipt(
    consultationId: string,
    messageId: string
  ): Promise<void> {
    try {
      console.log('MessageService.sendReadReceipt called with:', {
        consultationId,
        messageId,
      })

      // 优先使用 WebSocket 发送
      if (this.webSocketConnectionId) {
        try {
          await webSocketService.sendReadReceipt(
            this.webSocketConnectionId,
            consultationId,
            messageId
          )
          return
        } catch (wsError) {
          console.warn(
            'WebSocket read receipt failed, falling back to Tauri:',
            wsError
          )
        }
      }

      // 使用 Tauri 命令发送
      await invoke('send_read_receipt', {
        request: {
          connection_id: this.webSocketConnectionId || 'default',
          consultation_id: consultationId,
          message_id: messageId,
        },
      })
    } catch (error) {
      console.error('Send read receipt failed:', error)
      // 已读回执发送失败不应该阻塞用户操作
    }
  }

  // 发送输入状态
  async sendTypingStatus(
    consultationId: string,
    isTyping: boolean
  ): Promise<void> {
    try {
      console.log('MessageService.sendTypingStatus called with:', {
        consultationId,
        isTyping,
      })

      // 优先使用 WebSocket 发送
      if (this.webSocketConnectionId) {
        try {
          await webSocketService.sendTypingStatus(
            this.webSocketConnectionId,
            consultationId,
            isTyping
          )
          return
        } catch (wsError) {
          console.warn(
            'WebSocket typing status failed, falling back to Tauri:',
            wsError
          )
        }
      }

      // 使用 Tauri 命令发送
      await invoke('send_typing_status', {
        request: {
          connection_id: this.webSocketConnectionId || 'default',
          consultation_id: consultationId,
          is_typing: isTyping,
        },
      })
    } catch (error) {
      console.error('Send typing status failed:', error)
      // 输入状态发送失败不应该阻塞用户操作
    }
  }

  // 重试失败的消息
  async retryFailedMessage(message: Message): Promise<Message> {
    try {
      console.log('MessageService.retryFailedMessage called with:', message.id)

      // 重新发送消息
      const retriedMessage = await this.sendMessage(message.consultationId, {
        type: message.type,
        content: message.content,
        sender: message.sender,
        fileInfo: message.fileInfo,
      })

      return retriedMessage
    } catch (error) {
      console.error('Retry failed message failed:', error)
      throw new Error('重发消息失败')
    }
  }

  // 添加消息到离线队列
  private addToQueue(
    consultationId: string,
    request: SendMessageRequest
  ): void {
    const queue = this.messageQueue.get(consultationId) || []
    queue.push(request)
    this.messageQueue.set(consultationId, queue)
    console.log(`Message added to queue for consultation: ${consultationId}`)
  }

  // 处理离线消息队列
  async processMessageQueue(): Promise<void> {
    if (!this.isOnline) return

    for (const [consultationId, queue] of this.messageQueue.entries()) {
      const processedMessages: SendMessageRequest[] = []

      for (const request of queue) {
        try {
          await invoke('send_message', { request })
          processedMessages.push(request)
          console.log(`Queued message sent for consultation: ${consultationId}`)
        } catch (error) {
          console.error('Failed to send queued message:', error)
          break // 停止处理剩余消息，等待下次重试
        }
      }

      // 移除已成功发送的消息
      const remainingQueue = queue.filter(
        msg => !processedMessages.includes(msg)
      )
      if (remainingQueue.length === 0) {
        this.messageQueue.delete(consultationId)
      } else {
        this.messageQueue.set(consultationId, remainingQueue)
      }
    }
  }

  // 设置网络状态
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline
    this.isOnline = isOnline

    // 如果从离线变为在线，处理消息队列
    if (wasOffline && isOnline) {
      this.processMessageQueue()
    }
  }

  // 获取网络状态
  getOnlineStatus(): boolean {
    return this.isOnline
  }

  // 获取队列中的消息数量
  getQueuedMessageCount(consultationId?: string): number {
    if (consultationId) {
      return this.messageQueue.get(consultationId)?.length || 0
    }

    let total = 0
    for (const queue of this.messageQueue.values()) {
      total += queue.length
    }
    return total
  }
}
