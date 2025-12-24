import React, { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Space,
  Typography,
  List,
  Divider,
  Input,
  message,
} from 'antd'
import {
  WifiOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SendOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useWebSocket } from '@/stores/webSocketStore'
import type { ConnectionStatus } from '@/types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface WebSocketStatusProps {
  className?: string
}

const getStatusColor = (
  status: ConnectionStatus
): 'success' | 'processing' | 'default' | 'error' => {
  switch (status) {
    case 'connected':
      return 'success'
    case 'connecting':
    case 'reconnecting':
      return 'processing'
    case 'disconnected':
      return 'default'
    default:
      return 'error'
  }
}

const getStatusIcon = (status: ConnectionStatus): React.ReactNode => {
  switch (status) {
    case 'connected':
      return <WifiOutlined />
    case 'connecting':
    case 'reconnecting':
      return <LoadingOutlined spin />
    case 'disconnected':
      return <DisconnectOutlined />
    default:
      return <DisconnectOutlined />
  }
}

const getStatusText = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '连接中'
    case 'reconnecting':
      return '重连中'
    case 'disconnected':
      return '已断开'
    default:
      return '错误'
  }
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  className,
}) => {
  const {
    connections,
    activeConnection,
    isInitialized,
    queuedMessageCount,
    connectionEvents,
    initialize,
    createConnection,
    closeConnection,
    setActiveConnection,
    sendMessage,
    processMessageQueue,
    clearMessageQueue,
    reconnectConnection,
    reconnectAllConnections,
    isConnected,
    hasActiveConnection,
  } = useWebSocket()

  const [testMessage, setTestMessage] = useState('')
  const [testConsultationId, setTestConsultationId] = useState(
    'test-consultation-123'
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      initialize().catch(error => {
        console.error('Failed to initialize WebSocket:', error)
        message.error('WebSocket 初始化失败')
      })
    }
  }, [isInitialized, initialize])

  const handleCreateConnection = async () => {
    setIsLoading(true)
    try {
      const connectionId = await createConnection({
        url: 'ws://localhost:3000',
        authToken: 'test-token-' + Date.now(),
        autoReconnect: true,
        reconnectAttempts: 5,
        reconnectDelay: 2000,
      })

      setActiveConnection(connectionId)
      message.success('WebSocket 连接创建成功')
    } catch (error) {
      console.error('Failed to create connection:', error)
      message.error('创建 WebSocket 连接失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseConnection = async (connectionId: string) => {
    try {
      await closeConnection(connectionId)
      message.success('WebSocket 连接已关闭')
    } catch (error) {
      console.error('Failed to close connection:', error)
      message.error('关闭 WebSocket 连接失败')
    }
  }

  const handleSendTestMessage = async () => {
    if (!activeConnection || !testMessage.trim()) {
      message.warning('请输入测试消息')
      return
    }

    setIsLoading(true)
    try {
      await sendMessage(activeConnection, testConsultationId, {
        consultationId: testConsultationId,
        type: 'text',
        content: testMessage,
        sender: 'doctor',
      })

      setTestMessage('')
      message.success('测试消息发送成功')
    } catch (error) {
      console.error('Failed to send test message:', error)
      message.error('发送测试消息失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessQueue = async () => {
    setIsLoading(true)
    try {
      await processMessageQueue()
      message.success('消息队列处理完成')
    } catch (error) {
      console.error('Failed to process queue:', error)
      message.error('处理消息队列失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReconnectAll = async () => {
    setIsLoading(true)
    try {
      await reconnectAllConnections()
      message.success('重连所有连接完成')
    } catch (error) {
      console.error('Failed to reconnect all:', error)
      message.error('重连失败')
    } finally {
      setIsLoading(false)
    }
  }

  const connectionList = Array.from(connections.entries())
  const recentEvents = connectionEvents.slice(0, 10)

  return (
    <div className={className}>
      <Card title="WebSocket 实时通信状态" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 总体状态 */}
          <div>
            <Space>
              <Badge
                status={hasActiveConnection() ? 'success' : 'error'}
                text={`WebSocket 服务: ${isInitialized ? '已初始化' : '未初始化'}`}
              />
              {queuedMessageCount > 0 && (
                <Badge count={queuedMessageCount} showZero>
                  <MessageOutlined /> 队列消息
                </Badge>
              )}
            </Space>
          </div>

          {/* 操作按钮 */}
          <Space wrap>
            <Button
              type="primary"
              icon={<WifiOutlined />}
              onClick={handleCreateConnection}
              loading={isLoading}
            >
              创建连接
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReconnectAll}
              loading={isLoading}
              disabled={connectionList.length === 0}
            >
              重连所有
            </Button>
            <Button
              icon={<MessageOutlined />}
              onClick={handleProcessQueue}
              loading={isLoading}
              disabled={queuedMessageCount === 0}
            >
              处理队列 ({queuedMessageCount})
            </Button>
            <Button
              danger
              onClick={clearMessageQueue}
              disabled={queuedMessageCount === 0}
            >
              清空队列
            </Button>
          </Space>

          <Divider />

          {/* 连接列表 */}
          <div>
            <Title level={5}>活跃连接</Title>
            {connectionList.length === 0 ? (
              <Text type="secondary">暂无连接</Text>
            ) : (
              <List
                size="small"
                dataSource={connectionList}
                renderItem={([connectionId, connection]) => (
                  <List.Item
                    actions={[
                      <Button
                        key="set-active"
                        size="small"
                        type={
                          activeConnection === connectionId
                            ? 'primary'
                            : 'default'
                        }
                        onClick={() => setActiveConnection(connectionId)}
                      >
                        {activeConnection === connectionId
                          ? '当前活跃'
                          : '设为活跃'}
                      </Button>,
                      <Button
                        key="reconnect"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => reconnectConnection(connectionId)}
                        disabled={connection.status === 'connected'}
                      >
                        重连
                      </Button>,
                      <Button
                        key="close"
                        size="small"
                        danger
                        onClick={() => handleCloseConnection(connectionId)}
                      >
                        关闭
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(connection.status)}
                      title={
                        <Space>
                          <Text strong>{connectionId.slice(0, 12)}...</Text>
                          <Badge
                            status={getStatusColor(connection.status)}
                            text={getStatusText(connection.status)}
                          />
                        </Space>
                      }
                      description={
                        <div>
                          <Text type="secondary">
                            URL: {connection.config.url}
                          </Text>
                          {connection.lastConnected && (
                            <div>
                              <Text type="secondary">
                                最后连接:{' '}
                                {connection.lastConnected.toLocaleTimeString()}
                              </Text>
                            </div>
                          )}
                          {connection.lastError && (
                            <div>
                              <Text type="danger">
                                错误: {connection.lastError}
                              </Text>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>

          <Divider />

          {/* 测试消息发送 */}
          <div>
            <Title level={5}>测试消息发送</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                placeholder="问诊 ID"
                value={testConsultationId}
                onChange={e => setTestConsultationId(e.target.value)}
              />
              <TextArea
                placeholder="输入测试消息..."
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                rows={3}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendTestMessage}
                loading={isLoading}
                disabled={!hasActiveConnection() || !testMessage.trim()}
              >
                发送测试消息
              </Button>
            </Space>
          </div>

          <Divider />

          {/* 连接事件日志 */}
          <div>
            <Title level={5}>连接事件 (最近 10 条)</Title>
            {recentEvents.length === 0 ? (
              <Text type="secondary">暂无事件</Text>
            ) : (
              <List
                size="small"
                dataSource={recentEvents}
                renderItem={event => (
                  <List.Item>
                    <Space>
                      <Badge
                        status={getStatusColor(
                          event.type === 'connected'
                            ? 'connected'
                            : event.type === 'disconnected'
                              ? 'disconnected'
                              : event.type === 'connecting'
                                ? 'connecting'
                                : event.type === 'reconnecting'
                                  ? 'reconnecting'
                                  : 'disconnected'
                        )}
                      />
                      <Text strong>{event.type}</Text>
                      <Text type="secondary">
                        {event.connectionId.slice(0, 12)}...
                      </Text>
                      <Text type="secondary">
                        {event.timestamp.toLocaleTimeString()}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default WebSocketStatus
