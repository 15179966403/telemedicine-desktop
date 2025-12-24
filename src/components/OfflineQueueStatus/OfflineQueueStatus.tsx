/**
 * 离线队列状态组件
 * Offline queue status component
 */

import React, { useState } from 'react'
import {
  Card,
  Progress,
  Space,
  Button,
  Typography,
  List,
  Tag,
  Tooltip,
  Modal,
  Empty,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  SyncOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useOfflineStore } from '@/stores/offlineStore'
import type { QueuedMessage } from '@/services/offlineMessageQueue'
import './OfflineQueueStatus.css'

const { Title, Text } = Typography

export interface OfflineQueueStatusProps {
  className?: string
  showDetails?: boolean
}

export const OfflineQueueStatus: React.FC<OfflineQueueStatusProps> = ({
  className,
  showDetails = false,
}) => {
  const {
    queueStats,
    isSyncing,
    networkStatus,
    processOfflineQueue,
    clearOfflineQueue,
  } = useOfflineStore()

  const [showQueueModal, setShowQueueModal] = useState(false)

  // 计算同步进度
  const getSyncProgress = () => {
    const { totalMessages, sentMessages } = queueStats
    if (totalMessages === 0) return 100
    return Math.round((sentMessages / totalMessages) * 100)
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'sending':
        return 'blue'
      case 'sent':
        return 'green'
      case 'failed':
        return 'red'
      default:
        return 'default'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined />
      case 'sending':
        return <SyncOutlined spin />
      case 'sent':
        return <CheckCircleOutlined />
      case 'failed':
        return <CloseCircleOutlined />
      default:
        return null
    }
  }

  // 处理同步操作
  const handleSync = async () => {
    if (networkStatus === 'offline') {
      Modal.warning({
        title: '网络离线',
        content: '当前网络离线，无法进行同步操作。',
      })
      return
    }

    try {
      await processOfflineQueue()
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  // 处理清空队列
  const handleClearQueue = () => {
    Modal.confirm({
      title: '确认清空队列',
      content: '这将删除所有待同步的消息，此操作不可撤销。',
      icon: <ExclamationCircleOutlined />,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await clearOfflineQueue()
        } catch (error) {
          console.error('Clear queue failed:', error)
        }
      },
    })
  }

  // 渲染队列详情模态框
  const renderQueueModal = () => {
    // 这里应该从 offlineMessageQueue 获取详细的消息列表
    // 为了演示，我们创建一些模拟数据
    const mockMessages: QueuedMessage[] = []

    return (
      <Modal
        title="离线队列详情"
        open={showQueueModal}
        onCancel={() => setShowQueueModal(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setShowQueueModal(false)}>
            关闭
          </Button>,
        ]}
      >
        <div className="queue-modal-content">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic
                title="总消息数"
                value={queueStats.totalMessages}
                prefix={<SyncOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="待发送"
                value={queueStats.pendingMessages}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="发送中"
                value={queueStats.sendingMessages}
                prefix={<SyncOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已发送"
                value={queueStats.sentMessages}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>

          {mockMessages.length > 0 ? (
            <List
              dataSource={mockMessages}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Tooltip title="重试">
                      <Button
                        type="text"
                        icon={<ReloadOutlined />}
                        size="small"
                        disabled={
                          item.status === 'sent' || item.status === 'sending'
                        }
                      />
                    </Tooltip>,
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        size="small"
                        danger
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={getStatusIcon(item.status)}
                    title={
                      <Space>
                        <Text>{item.message.content}</Text>
                        <Tag color={getStatusColor(item.status)}>
                          {item.status}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">
                          问诊ID: {item.consultationId}
                        </Text>
                        <Text type="secondary">
                          创建时间: {item.timestamp.toLocaleString()}
                        </Text>
                        {item.retryCount > 0 && (
                          <Text type="secondary">
                            重试次数: {item.retryCount}/{item.maxRetries}
                          </Text>
                        )}
                        {item.lastError && (
                          <Text type="danger" style={{ fontSize: '12px' }}>
                            错误: {item.lastError}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="队列为空" />
          )}
        </div>
      </Modal>
    )
  }

  // 如果没有待同步的消息且不显示详情，则不显示组件
  if (!showDetails && queueStats.totalMessages === 0) {
    return null
  }

  return (
    <div className={`offline-queue-status ${className || ''}`}>
      <Card
        title={
          <Space>
            <SyncOutlined spin={isSyncing} />
            <span>离线队列状态</span>
          </Space>
        }
        size="small"
        extra={
          <Space>
            {queueStats.totalMessages > 0 && (
              <Button
                type="link"
                size="small"
                onClick={() => setShowQueueModal(true)}
              >
                查看详情
              </Button>
            )}
          </Space>
        }
        className="queue-status-card"
      >
        <div className="queue-status-content">
          {queueStats.totalMessages > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="queue-progress">
                <Progress
                  percent={getSyncProgress()}
                  status={isSyncing ? 'active' : 'normal'}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {queueStats.sentMessages}/{queueStats.totalMessages} 已同步
                </Text>
              </div>

              <div className="queue-stats">
                <Space wrap>
                  {queueStats.pendingMessages > 0 && (
                    <Tag color="orange" icon={<ClockCircleOutlined />}>
                      待发送 {queueStats.pendingMessages}
                    </Tag>
                  )}
                  {queueStats.sendingMessages > 0 && (
                    <Tag color="blue" icon={<SyncOutlined spin />}>
                      发送中 {queueStats.sendingMessages}
                    </Tag>
                  )}
                  {queueStats.failedMessages > 0 && (
                    <Tag color="red" icon={<CloseCircleOutlined />}>
                      失败 {queueStats.failedMessages}
                    </Tag>
                  )}
                  {queueStats.sentMessages > 0 && (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      已发送 {queueStats.sentMessages}
                    </Tag>
                  )}
                </Space>
              </div>

              <div className="queue-actions">
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SyncOutlined />}
                    loading={isSyncing}
                    disabled={networkStatus === 'offline'}
                    onClick={handleSync}
                  >
                    {isSyncing ? '同步中...' : '立即同步'}
                  </Button>
                  <Button
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={handleClearQueue}
                  >
                    清空队列
                  </Button>
                </Space>
              </div>
            </Space>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="队列为空"
              style={{ margin: '16px 0' }}
            />
          )}
        </div>
      </Card>

      {renderQueueModal()}
    </div>
  )
}

export default OfflineQueueStatus
