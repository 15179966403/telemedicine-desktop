import { io, Socket } from 'socket.io-client'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Message, ConnectionStatus, MessageCallback } from '@/types'

// WebSocket 连接配置
export interface WebSocketConfig {
  url: string
  authToken?: string
  autoReconnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

// WebSocket 连接状态
export interface WebSocketConnectionInfo {
  id: string
  status: ConnectionStatus
  config: WebSocketConfig
  socket?: Socket
  lastConnected?: Date
  lastError?: string
}

// 消息队列项
export interface QueuedMessage {
  id: string
  consultationId: string
  type: string
  content: string
  filePath?: string
  retryCount: number
  createdAt: Date
}

export class WebSocketService {
  private static instance: WebSocketService
  private connections: Map<string, WebSocketConnectionInfo> = new Map()
  private messageCallbacks: Map<string, MessageCallback[]> = new Map()
  private eventListeners: Map<string, Function[]> = new Map()
  private messageQueue: QueuedMessage[] = []
  private isInitialized = false

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  // 初始化服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 监听 Tauri 事件
      await this.setupTauriEventListeners()
      this.isInitialized = true
      console.log('WebSocket service initialized')
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error)
      throw error
    }
  }

  // 创建 WebSocket 连接
  async createConnection(config: WebSocketConfig): Promise<string> {
    try {
      console.log('Creating WebSocket connection:', config.url)

      // 创建 Socket.IO 连接
      const socket = io(config.url, {
        auth: {
          token: config.authToken,
        },
        autoConnect: false,
        reconnection: config.autoReconnect ?? true,
        reconnectionAttempts: config.reconnectAttempts ?? 5,
        reconnectionDelay: config.reconnectDelay ?? 2000,
      })

      const connectionId = `ws-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`

      // 创建连接信息
      const connectionInfo: WebSocketConnectionInfo = {
        id: connectionId,
        status: 'connecting',
        config,
        socket,
      }

      this.connections.set(connectionId, connectionInfo)

      // 设置 Socket.IO 事件监听器
      this.setupSocketEventListeners(connectionId, socket)

      // 连接到服务器
      socket.connect()

      // 同时创建 Tauri WebSocket 连接（作为备用）
      try {
        await invoke('create_websocket_connection', {
          request: {
            url: config.url,
            auth_token: config.authToken,
          },
        })
      } catch (error) {
        console.warn('Failed to create Tauri WebSocket connection:', error)
      }

      return connectionId
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      throw new Error('创建 WebSocket 连接失败')
    }
  }

  // 关闭连接
  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    try {
      // 断开 Socket.IO 连接
      if (connection.socket) {
        connection.socket.disconnect()
      }

      // 关闭 Tauri WebSocket 连接
      try {
        await invoke('close_websocket_connection', { connectionId })
      } catch (error) {
        console.warn('Failed to close Tauri WebSocket connection:', error)
      }

      // 清理连接信息
      this.connections.delete(connectionId)
      this.messageCallbacks.delete(connectionId)

      console.log(`WebSocket connection closed: ${connectionId}`)
    } catch (error) {
      console.error('Failed to close WebSocket connection:', error)
      throw new Error('关闭 WebSocket 连接失败')
    }
  }

  // 获取连接状态
  getConnectionStatus(connectionId: string): ConnectionStatus {
    const connection = this.connections.get(connectionId)
    return connection?.status || 'disconnected'
  }

  // 获取所有连接状态
  getAllConnectionsStatus(): Record<string, ConnectionStatus> {
    const status: Record<string, ConnectionStatus> = {}
    for (const [id, connection] of this.connections) {
      status[id] = connection.status
    }
    return status
  }

  // 发送消息
  async sendMessage(
    connectionId: string,
    consultationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'status'>
  ): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const messageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      consultationId,
      type: message.type,
      content: message.content,
      sender: message.sender,
      timestamp: new Date(),
      fileInfo: message.fileInfo,
    }

    try {
      if (connection.status === 'connected' && connection.socket?.connected) {
        // 通过 Socket.IO 发送
        connection.socket.emit('message', {
          consultation_id: consultationId,
          message: messageData,
        })
        console.log('Message sent via Socket.IO:', messageData.id)
      } else {
        // 添加到队列
        this.addToQueue({
          id: messageData.id,
          consultationId,
          type: message.type,
          content: message.content,
          filePath: message.fileInfo?.localPath,
          retryCount: 0,
          createdAt: new Date(),
        })
        throw new Error('连接未建立，消息已加入队列')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  // 订阅问诊消息
  async subscribeToConsultation(
    connectionId: string,
    consultationId: string,
    callback: MessageCallback
  ): Promise<() => void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    // 添加回调函数
    const callbacks = this.messageCallbacks.get(consultationId) || []
    callbacks.push(callback)
    this.messageCallbacks.set(consultationId, callbacks)

    // 通过 Socket.IO 订阅
    if (connection.socket?.connected) {
      connection.socket.emit('subscribe', { consultation_id: consultationId })
    }

    // 通过 Tauri 订阅（备用）
    try {
      await invoke('subscribe_to_consultation', {
        request: {
          connection_id: connectionId,
          consultation_id: consultationId,
        },
      })
    } catch (error) {
      console.warn('Failed to subscribe via Tauri:', error)
    }

    console.log(`Subscribed to consultation: ${consultationId}`)

    // 返回取消订阅函数
    return () => {
      this.unsubscribeFromConsultation(connectionId, consultationId, callback)
    }
  }

  // 取消订阅问诊消息
  async unsubscribeFromConsultation(
    connectionId: string,
    consultationId: string,
    callback?: MessageCallback
  ): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    // 移除回调函数
    const callbacks = this.messageCallbacks.get(consultationId) || []
    if (callback) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    } else {
      callbacks.length = 0 // 清空所有回调
    }

    if (callbacks.length === 0) {
      this.messageCallbacks.delete(consultationId)

      // 通过 Socket.IO 取消订阅
      if (connection.socket?.connected) {
        connection.socket.emit('unsubscribe', {
          consultation_id: consultationId,
        })
      }

      // 通过 Tauri 取消订阅（备用）
      try {
        await invoke('unsubscribe_from_consultation', {
          request: {
            connection_id: connectionId,
            consultation_id: consultationId,
          },
        })
      } catch (error) {
        console.warn('Failed to unsubscribe via Tauri:', error)
      }

      console.log(`Unsubscribed from consultation: ${consultationId}`)
    } else {
      this.messageCallbacks.set(consultationId, callbacks)
    }
  }

  // 发送已读回执
  async sendReadReceipt(
    connectionId: string,
    consultationId: string,
    messageId: string
  ): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    try {
      // 通过 Socket.IO 发送
      if (connection.socket?.connected) {
        connection.socket.emit('read_receipt', {
          consultation_id: consultationId,
          message_id: messageId,
          read_by: 'doctor',
        })
      }

      // 通过 Tauri 发送（备用）
      try {
        await invoke('send_read_receipt', {
          request: {
            connection_id: connectionId,
            consultation_id: consultationId,
            message_id: messageId,
          },
        })
      } catch (error) {
        console.warn('Failed to send read receipt via Tauri:', error)
      }

      console.log(`Read receipt sent: ${messageId}`)
    } catch (error) {
      console.error('Failed to send read receipt:', error)
      throw new Error('发送已读回执失败')
    }
  }

  // 发送输入状态
  async sendTypingStatus(
    connectionId: string,
    consultationId: string,
    isTyping: boolean
  ): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    try {
      // 通过 Socket.IO 发送
      if (connection.socket?.connected) {
        connection.socket.emit('typing', {
          consultation_id: consultationId,
          user_id: 'doctor',
          is_typing: isTyping,
        })
      }

      // 通过 Tauri 发送（备用）
      try {
        await invoke('send_typing_status', {
          request: {
            connection_id: connectionId,
            consultation_id: consultationId,
            is_typing: isTyping,
          },
        })
      } catch (error) {
        console.warn('Failed to send typing status via Tauri:', error)
      }

      console.log(`Typing status sent: ${isTyping}`)
    } catch (error) {
      console.error('Failed to send typing status:', error)
      throw new Error('发送输入状态失败')
    }
  }

  // 处理离线消息队列
  async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return

    const processedMessages: string[] = []

    for (const queuedMessage of this.messageQueue) {
      try {
        // 找到可用的连接
        const availableConnection = Array.from(this.connections.values()).find(
          conn => conn.status === 'connected' && conn.socket?.connected
        )

        if (availableConnection) {
          availableConnection.socket!.emit('message', {
            consultation_id: queuedMessage.consultationId,
            message: {
              id: queuedMessage.id,
              consultationId: queuedMessage.consultationId,
              type: queuedMessage.type,
              content: queuedMessage.content,
              sender: 'doctor',
              timestamp: queuedMessage.createdAt,
              fileInfo: queuedMessage.filePath
                ? {
                    id: queuedMessage.id,
                    name: queuedMessage.content,
                    size: 0,
                    type: '',
                    url: queuedMessage.filePath,
                    localPath: queuedMessage.filePath,
                  }
                : undefined,
            },
          })

          processedMessages.push(queuedMessage.id)
          console.log(`Queued message sent: ${queuedMessage.id}`)
        } else {
          break // 没有可用连接，停止处理
        }
      } catch (error) {
        console.error(
          `Failed to send queued message ${queuedMessage.id}:`,
          error
        )
        queuedMessage.retryCount++
        if (queuedMessage.retryCount >= 3) {
          processedMessages.push(queuedMessage.id) // 移除失败次数过多的消息
        }
        break
      }
    }

    // 移除已处理的消息
    this.messageQueue = this.messageQueue.filter(
      msg => !processedMessages.includes(msg.id)
    )

    console.log(
      `Processed ${processedMessages.length} queued messages, ${this.messageQueue.length} remaining`
    )
  }

  // 获取队列中的消息数量
  getQueuedMessageCount(): number {
    return this.messageQueue.length
  }

  // 清空消息队列
  clearMessageQueue(): void {
    this.messageQueue = []
    console.log('Message queue cleared')
  }

  // 添加事件监听器
  addEventListener(event: string, callback: Function): () => void {
    const listeners = this.eventListeners.get(event) || []
    listeners.push(callback)
    this.eventListeners.set(event, listeners)

    // 返回移除监听器的函数
    return () => {
      const listeners = this.eventListeners.get(event) || []
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
        if (listeners.length === 0) {
          this.eventListeners.delete(event)
        } else {
          this.eventListeners.set(event, listeners)
        }
      }
    }
  }

  // 私有方法：添加消息到队列
  private addToQueue(message: QueuedMessage): void {
    this.messageQueue.push(message)
    console.log(
      `Message added to queue: ${message.id}, total queued: ${this.messageQueue.length}`
    )
  }

  // 私有方法：触发事件
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    })
  }

  // 私有方法：设置 Socket.IO 事件监听器
  private setupSocketEventListeners(
    connectionId: string,
    socket: Socket
  ): void {
    socket.on('connect', () => {
      console.log(`Socket.IO connected: ${connectionId}`)
      this.updateConnectionStatus(connectionId, 'connected')
      this.emitEvent('connected', { connectionId })

      // 处理队列中的消息
      this.processMessageQueue()
    })

    socket.on('disconnect', reason => {
      console.log(`Socket.IO disconnected: ${connectionId}, reason: ${reason}`)
      this.updateConnectionStatus(connectionId, 'disconnected')
      this.emitEvent('disconnected', { connectionId, reason })
    })

    socket.on('connect_error', error => {
      console.error(`Socket.IO connection error: ${connectionId}`, error)
      this.updateConnectionStatus(connectionId, 'disconnected')
      this.emitEvent('connection_error', { connectionId, error })
    })

    socket.on('reconnect', attemptNumber => {
      console.log(
        `Socket.IO reconnected: ${connectionId}, attempt: ${attemptNumber}`
      )
      this.updateConnectionStatus(connectionId, 'connected')
      this.emitEvent('reconnected', { connectionId, attemptNumber })

      // 处理队列中的消息
      this.processMessageQueue()
    })

    socket.on('reconnect_attempt', attemptNumber => {
      console.log(
        `Socket.IO reconnect attempt: ${connectionId}, attempt: ${attemptNumber}`
      )
      this.updateConnectionStatus(connectionId, 'reconnecting')
      this.emitEvent('reconnecting', { connectionId, attemptNumber })
    })

    socket.on('reconnect_error', error => {
      console.error(`Socket.IO reconnect error: ${connectionId}`, error)
      this.emitEvent('reconnect_error', { connectionId, error })
    })

    socket.on('reconnect_failed', () => {
      console.error(`Socket.IO reconnect failed: ${connectionId}`)
      this.updateConnectionStatus(connectionId, 'disconnected')
      this.emitEvent('reconnect_failed', { connectionId })
    })

    // 业务事件监听
    socket.on('message', (data: any) => {
      console.log('Received message via Socket.IO:', data)
      this.handleIncomingMessage(data)
    })

    socket.on('consultation_update', (data: any) => {
      console.log('Received consultation update via Socket.IO:', data)
      this.emitEvent('consultation_update', data)
    })

    socket.on('typing', (data: any) => {
      console.log('Received typing status via Socket.IO:', data)
      this.emitEvent('typing', data)
    })

    socket.on('read_receipt', (data: any) => {
      console.log('Received read receipt via Socket.IO:', data)
      this.emitEvent('read_receipt', data)
    })
  }

  // 私有方法：设置 Tauri 事件监听器
  private async setupTauriEventListeners(): Promise<void> {
    // 监听 WebSocket 连接事件
    await listen('websocket-connected', event => {
      console.log('Tauri WebSocket connected:', event.payload)
      this.emitEvent('tauri_connected', event.payload)
    })

    await listen('websocket-disconnected', event => {
      console.log('Tauri WebSocket disconnected:', event.payload)
      this.emitEvent('tauri_disconnected', event.payload)
    })

    await listen('websocket-connection-failed', event => {
      console.log('Tauri WebSocket connection failed:', event.payload)
      this.emitEvent('tauri_connection_failed', event.payload)
    })

    await listen('websocket-message-sent', event => {
      console.log('Tauri WebSocket message sent:', event.payload)
      this.emitEvent('tauri_message_sent', event.payload)
    })

    await listen('websocket-message-failed', event => {
      console.log('Tauri WebSocket message failed:', event.payload)
      this.emitEvent('tauri_message_failed', event.payload)
    })
  }

  // 私有方法：更新连接状态
  private updateConnectionStatus(
    connectionId: string,
    status: ConnectionStatus
  ): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.status = status
      if (status === 'connected') {
        connection.lastConnected = new Date()
      }
    }
  }

  // 私有方法：处理接收到的消息
  private handleIncomingMessage(data: any): void {
    try {
      const consultationId = data.consultation_id
      const message: Message = {
        id: data.message.id,
        consultationId: data.message.consultationId || consultationId,
        type: data.message.type,
        content: data.message.content,
        sender: data.message.sender,
        timestamp: new Date(data.message.timestamp),
        status: data.message.status || 'delivered',
        fileInfo: data.message.fileInfo,
      }

      // 调用相关的回调函数
      const callbacks = this.messageCallbacks.get(consultationId) || []
      callbacks.forEach(callback => {
        try {
          callback(message)
        } catch (error) {
          console.error('Error in message callback:', error)
        }
      })

      // 触发消息事件
      this.emitEvent('message_received', { consultationId, message })
    } catch (error) {
      console.error('Error handling incoming message:', error)
    }
  }
}

// 导出单例实例
export const webSocketService = WebSocketService.getInstance()
