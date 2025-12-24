import { create } from 'zustand'
import { webSocketService } from '@/services'
import type { ConnectionStatus, Message, MessageCallback } from '@/types'

// WebSocket 连接配置
export interface WebSocketConfig {
  url: string
  authToken?: string
  autoReconnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface WebSocketConnection {
  id: string
  config: WebSocketConfig
  status: ConnectionStatus
  lastConnected?: Date
  lastError?: string
}

interface WebSocketState {
  connections: Map<string, WebSocketConnection>
  activeConnection: string | null
  isInitialized: boolean
  queuedMessageCount: number
  connectionEvents: Array<{
    type: string
    connectionId: string
    timestamp: Date
    data?: any
  }>
}

interface WebSocketActions {
  // 初始化
  initialize: () => Promise<void>

  // 连接管理
  createConnection: (config: WebSocketConfig) => Promise<string>
  closeConnection: (connectionId: string) => Promise<void>
  setActiveConnection: (connectionId: string | null) => void

  // 状态管理
  updateConnectionStatus: (
    connectionId: string,
    status: ConnectionStatus
  ) => void
  getConnectionStatus: (connectionId: string) => ConnectionStatus
  getAllConnectionsStatus: () => Record<string, ConnectionStatus>

  // 消息发送
  sendMessage: (
    connectionId: string,
    consultationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'status'>
  ) => Promise<void>

  // 订阅管理
  subscribeToConsultation: (
    connectionId: string,
    consultationId: string,
    callback: MessageCallback
  ) => Promise<() => void>

  unsubscribeFromConsultation: (
    connectionId: string,
    consultationId: string,
    callback?: MessageCallback
  ) => Promise<void>

  // 消息确认
  sendReadReceipt: (
    connectionId: string,
    consultationId: string,
    messageId: string
  ) => Promise<void>

  // 输入状态
  sendTypingStatus: (
    connectionId: string,
    consultationId: string,
    isTyping: boolean
  ) => Promise<void>

  // 队列管理
  processMessageQueue: () => Promise<void>
  clearMessageQueue: () => void
  updateQueuedMessageCount: (count: number) => void

  // 事件管理
  addConnectionEvent: (type: string, connectionId: string, data?: any) => void
  clearConnectionEvents: () => void

  // 重连管理
  reconnectConnection: (connectionId: string) => Promise<string>
  reconnectAllConnections: () => Promise<void>
}

export const useWebSocketStore = create<WebSocketState & WebSocketActions>(
  (set, get) => ({
    // State
    connections: new Map(),
    activeConnection: null,
    isInitialized: false,
    queuedMessageCount: 0,
    connectionEvents: [],

    // Actions
    initialize: async () => {
      if (get().isInitialized) return

      try {
        await webSocketService.initialize()

        // 设置事件监听器
        webSocketService.addEventListener('connected', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'connected')
          get().addConnectionEvent('connected', data.connectionId, data)

          // 处理队列中的消息
          get().processMessageQueue()
        })

        webSocketService.addEventListener('disconnected', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'disconnected')
          get().addConnectionEvent('disconnected', data.connectionId, data)
        })

        webSocketService.addEventListener('reconnecting', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'reconnecting')
          get().addConnectionEvent('reconnecting', data.connectionId, data)
        })

        webSocketService.addEventListener('connection_error', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'disconnected')
          get().addConnectionEvent('connection_error', data.connectionId, data)

          // 更新连接的错误信息
          const { connections } = get()
          const connection = connections.get(data.connectionId)
          if (connection) {
            connection.lastError = data.error?.message || '连接错误'
            set({ connections: new Map(connections) })
          }
        })

        webSocketService.addEventListener('reconnected', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'connected')
          get().addConnectionEvent('reconnected', data.connectionId, data)

          // 处理队列中的消息
          get().processMessageQueue()
        })

        webSocketService.addEventListener('reconnect_failed', (data: any) => {
          get().updateConnectionStatus(data.connectionId, 'disconnected')
          get().addConnectionEvent('reconnect_failed', data.connectionId, data)
        })

        set({ isInitialized: true })
        console.log('WebSocket store initialized')
      } catch (error) {
        console.error('Failed to initialize WebSocket store:', error)
        throw error
      }
    },

    createConnection: async (config: WebSocketConfig) => {
      try {
        const connectionId = await webSocketService.createConnection(config)

        const connection: WebSocketConnection = {
          id: connectionId,
          config,
          status: 'connecting',
        }

        const { connections } = get()
        connections.set(connectionId, connection)
        set({ connections: new Map(connections) })

        get().addConnectionEvent('connection_created', connectionId, { config })

        console.log(`WebSocket connection created: ${connectionId}`)
        return connectionId
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        throw error
      }
    },

    closeConnection: async (connectionId: string) => {
      try {
        await webSocketService.closeConnection(connectionId)

        const { connections, activeConnection } = get()
        connections.delete(connectionId)

        const newState: Partial<WebSocketState> = {
          connections: new Map(connections),
        }

        if (activeConnection === connectionId) {
          newState.activeConnection = null
        }

        set(newState)

        get().addConnectionEvent('connection_closed', connectionId)

        console.log(`WebSocket connection closed: ${connectionId}`)
      } catch (error) {
        console.error('Failed to close WebSocket connection:', error)
        throw error
      }
    },

    setActiveConnection: (connectionId: string | null) => {
      set({ activeConnection: connectionId })
      console.log(`Active WebSocket connection set to: ${connectionId}`)
    },

    updateConnectionStatus: (
      connectionId: string,
      status: ConnectionStatus
    ) => {
      const { connections } = get()
      const connection = connections.get(connectionId)

      if (connection) {
        connection.status = status
        if (status === 'connected') {
          connection.lastConnected = new Date()
          connection.lastError = undefined
        }
        set({ connections: new Map(connections) })

        console.log(`Connection ${connectionId} status updated to: ${status}`)
      }
    },

    getConnectionStatus: (connectionId: string) => {
      const connection = get().connections.get(connectionId)
      return connection?.status || 'disconnected'
    },

    getAllConnectionsStatus: () => {
      const { connections } = get()
      const status: Record<string, ConnectionStatus> = {}

      for (const [id, connection] of connections) {
        status[id] = connection.status
      }

      return status
    },

    sendMessage: async (
      connectionId: string,
      consultationId: string,
      message: Omit<Message, 'id' | 'timestamp' | 'status'>
    ) => {
      try {
        await webSocketService.sendMessage(
          connectionId,
          consultationId,
          message
        )
        console.log(`Message sent via connection ${connectionId}`)
      } catch (error) {
        console.error('Failed to send message:', error)

        // 更新队列计数
        const queueCount = webSocketService.getQueuedMessageCount()
        set({ queuedMessageCount: queueCount })

        throw error
      }
    },

    subscribeToConsultation: async (
      connectionId: string,
      consultationId: string,
      callback: MessageCallback
    ) => {
      try {
        const unsubscribe = await webSocketService.subscribeToConsultation(
          connectionId,
          consultationId,
          callback
        )

        get().addConnectionEvent('subscribed', connectionId, { consultationId })

        console.log(
          `Subscribed to consultation ${consultationId} via connection ${connectionId}`
        )
        return unsubscribe
      } catch (error) {
        console.error('Failed to subscribe to consultation:', error)
        throw error
      }
    },

    unsubscribeFromConsultation: async (
      connectionId: string,
      consultationId: string,
      callback?: MessageCallback
    ) => {
      try {
        await webSocketService.unsubscribeFromConsultation(
          connectionId,
          consultationId,
          callback
        )

        get().addConnectionEvent('unsubscribed', connectionId, {
          consultationId,
        })

        console.log(
          `Unsubscribed from consultation ${consultationId} via connection ${connectionId}`
        )
      } catch (error) {
        console.error('Failed to unsubscribe from consultation:', error)
        throw error
      }
    },

    sendReadReceipt: async (
      connectionId: string,
      consultationId: string,
      messageId: string
    ) => {
      try {
        await webSocketService.sendReadReceipt(
          connectionId,
          consultationId,
          messageId
        )
        console.log(`Read receipt sent for message ${messageId}`)
      } catch (error) {
        console.error('Failed to send read receipt:', error)
        throw error
      }
    },

    sendTypingStatus: async (
      connectionId: string,
      consultationId: string,
      isTyping: boolean
    ) => {
      try {
        await webSocketService.sendTypingStatus(
          connectionId,
          consultationId,
          isTyping
        )
        console.log(`Typing status sent: ${isTyping}`)
      } catch (error) {
        console.error('Failed to send typing status:', error)
        // 输入状态发送失败不应该阻塞用户操作
      }
    },

    processMessageQueue: async () => {
      try {
        await webSocketService.processMessageQueue()
        const queueCount = webSocketService.getQueuedMessageCount()
        set({ queuedMessageCount: queueCount })

        if (queueCount === 0) {
          console.log('All queued messages processed')
        } else {
          console.log(`${queueCount} messages remaining in queue`)
        }
      } catch (error) {
        console.error('Failed to process message queue:', error)
      }
    },

    clearMessageQueue: () => {
      webSocketService.clearMessageQueue()
      set({ queuedMessageCount: 0 })
      console.log('Message queue cleared')
    },

    updateQueuedMessageCount: (count: number) => {
      set({ queuedMessageCount: count })
    },

    addConnectionEvent: (type: string, connectionId: string, data?: any) => {
      const { connectionEvents } = get()
      const newEvent = {
        type,
        connectionId,
        timestamp: new Date(),
        data,
      }

      // 保留最近的 100 个事件
      const updatedEvents = [newEvent, ...connectionEvents].slice(0, 100)
      set({ connectionEvents: updatedEvents })
    },

    clearConnectionEvents: () => {
      set({ connectionEvents: [] })
    },

    reconnectConnection: async (connectionId: string) => {
      const { connections } = get()
      const connection = connections.get(connectionId)

      if (!connection) {
        throw new Error(`Connection not found: ${connectionId}`)
      }

      try {
        // 关闭现有连接
        await get().closeConnection(connectionId)

        // 创建新连接
        const newConnectionId = await get().createConnection(connection.config)

        // 如果这是活跃连接，更新活跃连接ID
        if (get().activeConnection === connectionId) {
          get().setActiveConnection(newConnectionId)
        }

        console.log(
          `Connection reconnected: ${connectionId} -> ${newConnectionId}`
        )
        return newConnectionId
      } catch (error) {
        console.error(`Failed to reconnect connection ${connectionId}:`, error)
        throw error
      }
    },

    reconnectAllConnections: async () => {
      const { connections } = get()
      const reconnectPromises: Promise<void>[] = []

      for (const [connectionId, connection] of connections) {
        if (connection.status === 'disconnected') {
          reconnectPromises.push(
            get()
              .reconnectConnection(connectionId)
              .catch(error => {
                console.error(`Failed to reconnect ${connectionId}:`, error)
              })
          )
        }
      }

      await Promise.all(reconnectPromises)
      console.log('All disconnected connections reconnection attempted')
    },
  })
)

// 导出 WebSocket 钩子
export const useWebSocket = () => {
  const store = useWebSocketStore()

  return {
    // 状态
    connections: store.connections,
    activeConnection: store.activeConnection,
    isInitialized: store.isInitialized,
    queuedMessageCount: store.queuedMessageCount,
    connectionEvents: store.connectionEvents,

    // 方法
    initialize: store.initialize,
    createConnection: store.createConnection,
    closeConnection: store.closeConnection,
    setActiveConnection: store.setActiveConnection,
    sendMessage: store.sendMessage,
    subscribeToConsultation: store.subscribeToConsultation,
    unsubscribeFromConsultation: store.unsubscribeFromConsultation,
    sendReadReceipt: store.sendReadReceipt,
    sendTypingStatus: store.sendTypingStatus,
    processMessageQueue: store.processMessageQueue,
    clearMessageQueue: store.clearMessageQueue,
    reconnectConnection: store.reconnectConnection,
    reconnectAllConnections: store.reconnectAllConnections,

    // 辅助方法
    getConnectionStatus: store.getConnectionStatus,
    getAllConnectionsStatus: store.getAllConnectionsStatus,
    isConnected: (connectionId?: string) => {
      const id = connectionId || store.activeConnection
      return id ? store.getConnectionStatus(id) === 'connected' : false
    },
    hasActiveConnection: () => {
      return (
        store.activeConnection !== null &&
        store.getConnectionStatus(store.activeConnection) === 'connected'
      )
    },
  }
}
