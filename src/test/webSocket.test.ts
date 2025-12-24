import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { webSocketService, WebSocketService } from '@/services/webSocketService'
import { useWebSocketStore } from '@/stores/webSocketStore'
import type { Message, MessageCallback } from '@/types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    connected: true,
  })),
}))

describe('WebSocket Service', () => {
  let service: WebSocketService
  let mockCallback: MessageCallback

  beforeEach(() => {
    service = WebSocketService.getInstance()
    mockCallback = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理连接
    service.clearMessageQueue()
  })

  describe('Connection Management', () => {
    it('should create a WebSocket connection', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
        autoReconnect: true,
      }

      const connectionId = await service.createConnection(config)

      expect(connectionId).toBeDefined()
      expect(typeof connectionId).toBe('string')
      expect(connectionId).toMatch(/^ws-/)
    })

    it('should close a WebSocket connection', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      await service.closeConnection(connectionId)

      const status = service.getConnectionStatus(connectionId)
      expect(status).toBe('disconnected')
    })

    it('should get connection status', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const status = service.getConnectionStatus(connectionId)

      expect(['connecting', 'connected', 'disconnected']).toContain(status)
    })

    it('should get all connections status', async () => {
      const config1 = { url: 'ws://localhost:3000' }
      const config2 = { url: 'ws://localhost:3001' }

      const connectionId1 = await service.createConnection(config1)
      const connectionId2 = await service.createConnection(config2)

      const allStatus = service.getAllConnectionsStatus()

      expect(allStatus).toHaveProperty(connectionId1)
      expect(allStatus).toHaveProperty(connectionId2)
    })
  })

  describe('Message Sending', () => {
    it('should send a message through WebSocket', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const consultationId = 'consultation-123'
      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId,
        type: 'text',
        content: 'Hello, patient!',
        sender: 'doctor',
      }

      await expect(
        service.sendMessage(connectionId, consultationId, message)
      ).resolves.not.toThrow()
    })

    it('should queue message when connection is not available', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      await service.closeConnection(connectionId) // 关闭连接

      const consultationId = 'consultation-123'
      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId,
        type: 'text',
        content: 'Hello, patient!',
        sender: 'doctor',
      }

      await expect(
        service.sendMessage(connectionId, consultationId, message)
      ).rejects.toThrow('连接未建立，消息已加入队列')

      expect(service.getQueuedMessageCount()).toBeGreaterThan(0)
    })
  })

  describe('Subscription Management', () => {
    it('should subscribe to consultation messages', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const consultationId = 'consultation-123'

      const unsubscribe = await service.subscribeToConsultation(
        connectionId,
        consultationId,
        mockCallback
      )

      expect(typeof unsubscribe).toBe('function')

      // 测试取消订阅
      unsubscribe()
    })

    it('should unsubscribe from consultation messages', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const consultationId = 'consultation-123'

      await service.subscribeToConsultation(
        connectionId,
        consultationId,
        mockCallback
      )

      await expect(
        service.unsubscribeFromConsultation(
          connectionId,
          consultationId,
          mockCallback
        )
      ).resolves.not.toThrow()
    })
  })

  describe('Message Acknowledgments', () => {
    it('should send read receipt', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const consultationId = 'consultation-123'
      const messageId = 'message-456'

      await expect(
        service.sendReadReceipt(connectionId, consultationId, messageId)
      ).resolves.not.toThrow()
    })

    it('should send typing status', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)
      const consultationId = 'consultation-123'

      await expect(
        service.sendTypingStatus(connectionId, consultationId, true)
      ).resolves.not.toThrow()

      await expect(
        service.sendTypingStatus(connectionId, consultationId, false)
      ).resolves.not.toThrow()
    })
  })

  describe('Message Queue', () => {
    it('should process message queue when connection is restored', async () => {
      const config = {
        url: 'ws://localhost:3000',
        authToken: 'test-token',
      }

      const connectionId = await service.createConnection(config)

      // 添加一些消息到队列
      const consultationId = 'consultation-123'
      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId,
        type: 'text',
        content: 'Queued message',
        sender: 'doctor',
      }

      // 关闭连接以触发队列
      await service.closeConnection(connectionId)

      try {
        await service.sendMessage(connectionId, consultationId, message)
      } catch (error) {
        // 预期会失败并加入队列
      }

      const initialQueueCount = service.getQueuedMessageCount()
      expect(initialQueueCount).toBeGreaterThan(0)

      // 重新创建连接
      const newConnectionId = await service.createConnection(config)

      // 处理队列
      await service.processMessageQueue()

      const finalQueueCount = service.getQueuedMessageCount()
      expect(finalQueueCount).toBeLessThanOrEqual(initialQueueCount)
    })

    it('should clear message queue', () => {
      // 添加一些消息到队列（通过模拟）
      service.clearMessageQueue()
      expect(service.getQueuedMessageCount()).toBe(0)
    })
  })

  describe('Event Handling', () => {
    it('should add and remove event listeners', () => {
      const mockListener = vi.fn()
      const removeListener = service.addEventListener(
        'test-event',
        mockListener
      )

      expect(typeof removeListener).toBe('function')

      // 移除监听器
      removeListener()
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const config = {
        url: 'ws://invalid-url:9999',
        authToken: 'test-token',
      }

      // 连接到无效的 URL 应该不会抛出异常，而是返回连接 ID
      const connectionId = await service.createConnection(config)
      expect(connectionId).toBeDefined()

      // 状态应该反映连接问题
      const status = service.getConnectionStatus(connectionId)
      expect(['connecting', 'disconnected']).toContain(status)
    })

    it('should handle message sending errors', async () => {
      const connectionId = 'non-existent-connection'
      const consultationId = 'consultation-123'
      const message: Omit<Message, 'id' | 'timestamp' | 'status'> = {
        consultationId,
        type: 'text',
        content: 'Test message',
        sender: 'doctor',
      }

      await expect(
        service.sendMessage(connectionId, consultationId, message)
      ).rejects.toThrow()
    })
  })
})

describe('WebSocket Store', () => {
  beforeEach(() => {
    // 重置 store 状态
    useWebSocketStore.setState({
      connections: new Map(),
      activeConnection: null,
      isInitialized: false,
      queuedMessageCount: 0,
      connectionEvents: [],
    })
  })

  it('should initialize WebSocket store', async () => {
    const { initialize, isInitialized } = useWebSocketStore.getState()

    await initialize()

    expect(useWebSocketStore.getState().isInitialized).toBe(true)
  })

  it('should create and manage connections', async () => {
    const { initialize, createConnection, connections } =
      useWebSocketStore.getState()

    await initialize()

    const config = {
      url: 'ws://localhost:3000',
      authToken: 'test-token',
    }

    const connectionId = await createConnection(config)

    expect(connectionId).toBeDefined()
    expect(useWebSocketStore.getState().connections.has(connectionId)).toBe(
      true
    )
  })

  it('should set active connection', () => {
    const { setActiveConnection } = useWebSocketStore.getState()

    const connectionId = 'test-connection-id'
    setActiveConnection(connectionId)

    expect(useWebSocketStore.getState().activeConnection).toBe(connectionId)
  })

  it('should update connection status', () => {
    const { updateConnectionStatus, connections } = useWebSocketStore.getState()

    // 先添加一个连接
    const connectionId = 'test-connection-id'
    connections.set(connectionId, {
      id: connectionId,
      config: { url: 'ws://localhost:3000' },
      status: 'connecting',
    })

    updateConnectionStatus(connectionId, 'connected')

    const connection = useWebSocketStore
      .getState()
      .connections.get(connectionId)
    expect(connection?.status).toBe('connected')
  })

  it('should add connection events', () => {
    const { addConnectionEvent, connectionEvents } =
      useWebSocketStore.getState()

    addConnectionEvent('connected', 'test-connection-id', { test: 'data' })

    const events = useWebSocketStore.getState().connectionEvents
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('connected')
    expect(events[0].connectionId).toBe('test-connection-id')
  })

  it('should clear connection events', () => {
    const { addConnectionEvent, clearConnectionEvents } =
      useWebSocketStore.getState()

    // 添加一些事件
    addConnectionEvent('connected', 'test-connection-id')
    addConnectionEvent('disconnected', 'test-connection-id')

    expect(useWebSocketStore.getState().connectionEvents).toHaveLength(2)

    clearConnectionEvents()

    expect(useWebSocketStore.getState().connectionEvents).toHaveLength(0)
  })
})
