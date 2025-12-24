/**
 * 离线消息队列服务
 * Offline message queue service
 */

import { invoke } from '@tauri-apps/api/core'
import { StorageManager } from '@/utils/storage'
import { networkStatusService } from './networkStatusService'
import type { Message, MessageCallback } from '@/types'

// 队列中的消息项
export interface QueuedMessage {
  id: string
  consultationId: string
  message: Omit<Message, 'id' | 'timestamp' | 'status'>
  timestamp: Date
  retryCount: number
  maxRetries: number
  priority: 'high' | 'normal' | 'low'
  status: 'pending' | 'sending' | 'sent' | 'failed'
  lastError?: string
}

// 消息发送结果
export interface MessageSendResult {
  success: boolean
  messageId?: string
  error?: string
}

// 队列统计信息
export interface QueueStats {
  totalMessages: number
  pendingMessages: number
  sendingMessages: number
  failedMessages: number
  sentMessages: number
}

export class OfflineMessageQueue {
  private static instance: OfflineMessageQueue
  private storage: StorageManager
  private queue: QueuedMessage[] = []
  private isProcessing = false
  private processingTimer?: NodeJS.Timeout
  private callbacks: Map<string, MessageCallback[]> = new Map()
  private isInitialized = false

  constructor() {
    this.storage = StorageManager.getInstance()
  }

  static getInstance(): OfflineMessageQueue {
    if (!OfflineMessageQueue.instance) {
      OfflineMessageQueue.instance = new OfflineMessageQueue()
    }
    return OfflineMessageQueue.instance
  }

  // 初始化消息队列
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 加载持久化的队列数据
      await this.loadQueue()

      // 监听网络状态变化
      networkStatusService.addStatusListener(status => {
        if (status === 'online') {
          console.log('Network is online, processing message queue')
          this.processQueue()
        }
      })

      // 启动定期处理
      this.startPeriodicProcessing()

      this.isInitialized = true
      console.log('Offline message queue initialized')
    } catch (error) {
      console.error('Failed to initialize offline message queue:', error)
      throw error
    }
  }

  // 销毁队列服务
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = undefined
    }

    this.callbacks.clear()
    this.isInitialized = false
    console.log('Offline message queue destroyed')
  }

  // 添加消息到队列
  async addMessage(
    consultationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'status'>,
    priority: 'high' | 'normal' | 'low' = 'normal',
    maxRetries: number = 3
  ): Promise<string> {
    try {
      const messageId = `queue_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      const queuedMessage: QueuedMessage = {
        id: messageId,
        consultationId,
        message,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries,
        priority,
        status: 'pending',
      }

      // 根据优先级插入队列
      this.insertByPriority(queuedMessage)

      // 持久化队列
      await this.saveQueue()

      console.log(
        `Message added to queue: ${messageId} (priority: ${priority})`
      )

      // 如果网络在线，立即尝试处理
      if (networkStatusService.getCurrentStatus() === 'online') {
        this.processQueue()
      }

      return messageId
    } catch (error) {
      console.error('Failed to add message to queue:', error)
      throw new Error('添加消息到队列失败')
    }
  }

  // 移除队列中的消息
  async removeMessage(messageId: string): Promise<boolean> {
    try {
      const index = this.queue.findIndex(msg => msg.id === messageId)
      if (index === -1) {
        return false
      }

      this.queue.splice(index, 1)
      await this.saveQueue()

      console.log(`Message removed from queue: ${messageId}`)
      return true
    } catch (error) {
      console.error('Failed to remove message from queue:', error)
      return false
    }
  }

  // 获取队列中的消息
  getQueuedMessages(consultationId?: string): QueuedMessage[] {
    if (consultationId) {
      return this.queue.filter(msg => msg.consultationId === consultationId)
    }
    return [...this.queue]
  }

  // 获取队列统计信息
  getQueueStats(): QueueStats {
    const totalMessages = this.queue.length
    const pendingMessages = this.queue.filter(
      msg => msg.status === 'pending'
    ).length
    const sendingMessages = this.queue.filter(
      msg => msg.status === 'sending'
    ).length
    const failedMessages = this.queue.filter(
      msg => msg.status === 'failed'
    ).length
    const sentMessages = this.queue.filter(msg => msg.status === 'sent').length

    return {
      totalMessages,
      pendingMessages,
      sendingMessages,
      failedMessages,
      sentMessages,
    }
  }

  // 清空队列
  async clearQueue(consultationId?: string): Promise<void> {
    try {
      if (consultationId) {
        this.queue = this.queue.filter(
          msg => msg.consultationId !== consultationId
        )
      } else {
        this.queue = []
      }

      await this.saveQueue()
      console.log(
        `Queue cleared${consultationId ? ` for consultation ${consultationId}` : ''}`
      )
    } catch (error) {
      console.error('Failed to clear queue:', error)
      throw new Error('清空队列失败')
    }
  }

  // 重试失败的消息
  async retryFailedMessages(consultationId?: string): Promise<void> {
    try {
      const failedMessages = this.queue.filter(
        msg =>
          msg.status === 'failed' &&
          (!consultationId || msg.consultationId === consultationId)
      )

      failedMessages.forEach(msg => {
        msg.status = 'pending'
        msg.retryCount = 0
        msg.lastError = undefined
      })

      await this.saveQueue()

      console.log(`Retrying ${failedMessages.length} failed messages`)

      // 立即处理队列
      this.processQueue()
    } catch (error) {
      console.error('Failed to retry failed messages:', error)
      throw new Error('重试失败消息失败')
    }
  }

  // 添加消息发送回调
  addMessageCallback(
    consultationId: string,
    callback: MessageCallback
  ): () => void {
    const callbacks = this.callbacks.get(consultationId) || []
    callbacks.push(callback)
    this.callbacks.set(consultationId, callbacks)

    // 返回移除回调的函数
    return () => {
      const callbacks = this.callbacks.get(consultationId) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
        if (callbacks.length === 0) {
          this.callbacks.delete(consultationId)
        } else {
          this.callbacks.set(consultationId, callbacks)
        }
      }
    }
  }

  // 处理队列
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('Queue is already being processed')
      return
    }

    if (this.queue.length === 0) {
      return
    }

    // 检查网络状态
    const networkStatus = networkStatusService.getCurrentStatus()
    if (networkStatus === 'offline') {
      console.log('Network is offline, skipping queue processing')
      return
    }

    this.isProcessing = true
    console.log(`Processing message queue: ${this.queue.length} messages`)

    try {
      // 获取待处理的消息（按优先级排序）
      const pendingMessages = this.queue
        .filter(msg => msg.status === 'pending')
        .sort(
          (a, b) =>
            this.getPriorityValue(b.priority) -
            this.getPriorityValue(a.priority)
        )

      for (const queuedMessage of pendingMessages) {
        try {
          await this.sendQueuedMessage(queuedMessage)
        } catch (error) {
          console.error(
            `Failed to send queued message ${queuedMessage.id}:`,
            error
          )
        }
      }

      // 清理已发送的消息
      await this.cleanupSentMessages()

      // 保存队列状态
      await this.saveQueue()
    } finally {
      this.isProcessing = false
    }
  }

  // 私有方法：根据优先级插入消息
  private insertByPriority(message: QueuedMessage): void {
    const priorityValue = this.getPriorityValue(message.priority)

    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      if (this.getPriorityValue(this.queue[i].priority) < priorityValue) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, message)
  }

  // 私有方法：获取优先级数值
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 3
      case 'normal':
        return 2
      case 'low':
        return 1
      default:
        return 2
    }
  }

  // 私有方法：发送队列中的消息
  private async sendQueuedMessage(queuedMessage: QueuedMessage): Promise<void> {
    try {
      queuedMessage.status = 'sending'

      // 构造完整的消息对象
      const fullMessage: Message = {
        id: queuedMessage.id,
        consultationId: queuedMessage.consultationId,
        type: queuedMessage.message.type,
        content: queuedMessage.message.content,
        sender: queuedMessage.message.sender,
        timestamp: queuedMessage.timestamp,
        status: 'sending',
        fileInfo: queuedMessage.message.fileInfo,
      }

      // 发送消息
      const result = await this.sendMessage(fullMessage)

      if (result.success) {
        queuedMessage.status = 'sent'
        queuedMessage.lastError = undefined

        // 更新消息状态
        fullMessage.status = 'sent'
        if (result.messageId) {
          fullMessage.id = result.messageId
        }

        // 通知回调
        this.notifyMessageSent(queuedMessage.consultationId, fullMessage)

        console.log(`Queued message sent successfully: ${queuedMessage.id}`)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      queuedMessage.retryCount++
      queuedMessage.lastError =
        error instanceof Error ? error.message : 'Unknown error'

      if (queuedMessage.retryCount >= queuedMessage.maxRetries) {
        queuedMessage.status = 'failed'
        console.error(
          `Message failed after ${queuedMessage.maxRetries} retries: ${queuedMessage.id}`
        )
      } else {
        queuedMessage.status = 'pending'
        console.warn(
          `Message send failed, will retry (${queuedMessage.retryCount}/${queuedMessage.maxRetries}): ${queuedMessage.id}`
        )
      }
    }
  }

  // 私有方法：发送消息到服务器
  private async sendMessage(message: Message): Promise<MessageSendResult> {
    try {
      // 通过 Tauri 发送消息
      const result = await invoke<{
        success: boolean
        messageId?: string
        error?: string
      }>('send_message', {
        message: {
          consultation_id: message.consultationId,
          type: message.type,
          content: message.content,
          sender: message.sender,
          file_info: message.fileInfo,
        },
      })

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      }
    } catch (error) {
      console.error('Failed to send message via Tauri:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 私有方法：通知消息发送成功
  private notifyMessageSent(consultationId: string, message: Message): void {
    const callbacks = this.callbacks.get(consultationId) || []
    callbacks.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error('Error in message callback:', error)
      }
    })
  }

  // 私有方法：清理已发送的消息
  private async cleanupSentMessages(): Promise<void> {
    const sentMessages = this.queue.filter(msg => msg.status === 'sent')

    if (sentMessages.length > 0) {
      // 保留最近发送的消息一段时间，以便确认
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000) // 5分钟前
      const messagesToRemove = sentMessages.filter(
        msg => msg.timestamp < cutoffTime
      )

      messagesToRemove.forEach(msg => {
        const index = this.queue.indexOf(msg)
        if (index > -1) {
          this.queue.splice(index, 1)
        }
      })

      if (messagesToRemove.length > 0) {
        console.log(`Cleaned up ${messagesToRemove.length} sent messages`)
      }
    }
  }

  // 私有方法：启动定期处理
  private startPeriodicProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    // 每30秒处理一次队列
    this.processingTimer = setInterval(async () => {
      try {
        await this.processQueue()
      } catch (error) {
        console.error('Periodic queue processing failed:', error)
      }
    }, 30000)

    console.log('Periodic queue processing started')
  }

  // 私有方法：加载队列数据
  private async loadQueue(): Promise<void> {
    try {
      const queueData = this.storage.getItem<QueuedMessage[]>(
        'offline_message_queue'
      )
      if (queueData) {
        this.queue = queueData.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      }
      console.log(`Loaded ${this.queue.length} messages from queue`)
    } catch (error) {
      console.error('Failed to load message queue:', error)
      this.queue = []
    }
  }

  // 私有方法：保存队列数据
  private async saveQueue(): Promise<void> {
    try {
      this.storage.setItem('offline_message_queue', this.queue)
    } catch (error) {
      console.error('Failed to save message queue:', error)
    }
  }
}

// 导出单例实例
export const offlineMessageQueue = OfflineMessageQueue.getInstance()
