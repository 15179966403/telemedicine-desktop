import React, { useEffect, useState } from 'react'
import {
  List,
  Card,
  Tag,
  Button,
  Avatar,
  Space,
  Typography,
  Badge,
  Tooltip,
  Empty,
  Spin,
  message as antMessage,
  Modal,
} from 'antd'
import {
  UserOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  CheckOutlined,
  FileTextOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import { useConsultationStore } from '@/stores/consultationStore'
import { useWindowStore } from '@/stores/windowStore'
import type { Consultation } from '@/types'
import './PendingConsultationList.css'

const { Text, Title } = Typography

interface PendingConsultationListProps {
  onSelectConsultation?: (consultation: Consultation) => void
}

export const PendingConsultationList: React.FC<
  PendingConsultationListProps
> = ({ onSelectConsultation }) => {
  const {
    pendingConsultations,
    loading,
    error,
    refreshing,
    fetchPendingConsultations,
    acceptConsultation,
    setSelectedConsultation,
    clearError,
  } = useConsultationStore()

  const { createWindow } = useWindowStore()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingConsultations()
  }, [fetchPendingConsultations])

  // 获取优先级颜色
  const getPriorityColor = (priority: Consultation['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'red'
      case 'high':
        return 'orange'
      case 'normal':
        return 'blue'
      case 'low':
        return 'gray'
      default:
        return 'blue'
    }
  }

  // 获取优先级文本
  const getPriorityText = (priority: Consultation['priority']) => {
    switch (priority) {
      case 'urgent':
        return '紧急'
      case 'high':
        return '高'
      case 'normal':
        return '普通'
      case 'low':
        return '低'
      default:
        return '普通'
    }
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}天前`
    } else if (hours > 0) {
      return `${hours}小时前`
    } else if (minutes > 0) {
      return `${minutes}分钟前`
    } else {
      return '刚刚'
    }
  }

  // 查看详情
  const handleViewDetail = (consultation: Consultation) => {
    setSelectedConsultation(consultation)
    onSelectConsultation?.(consultation)
  }

  // 接受问诊
  const handleAcceptConsultation = async (consultation: Consultation) => {
    Modal.confirm({
      title: '确认接受问诊',
      content: `确定要接受患者 ${consultation.patientName} 的问诊吗？`,
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          setAcceptingId(consultation.id)
          await acceptConsultation(consultation.id)

          // 创建问诊窗口
          await createWindow({
            type: 'consultation',
            title: `问诊 - ${consultation.patientName}`,
            url: `/consultation/${consultation.id}`,
            data: {
              consultationId: consultation.id,
              patientName: consultation.patientName,
            },
            size: { width: 1000, height: 700 },
            position: { x: 100, y: 100 },
          })

          antMessage.success('已接受问诊，问诊窗口已打开')
        } catch (error) {
          antMessage.error('接受问诊失败')
        } finally {
          setAcceptingId(null)
        }
      },
    })
  }

  // 刷新列表
  const handleRefresh = () => {
    fetchPendingConsultations()
  }

  if (loading && pendingConsultations.length === 0) {
    return (
      <div className="pending-consultation-loading">
        <Spin size="large" />
        <p>加载待接诊列表中...</p>
      </div>
    )
  }

  return (
    <div className="pending-consultation-list">
      <div className="list-header">
        <Title level={4}>
          待接诊列表
          <Badge
            count={pendingConsultations.length}
            style={{ marginLeft: 8 }}
          />
        </Title>
        <Button onClick={handleRefresh} loading={refreshing} type="primary">
          刷新
        </Button>
      </div>

      {error && (
        <div className="error-message">
          <Text type="danger">{error}</Text>
          <Button size="small" onClick={clearError} style={{ marginLeft: 8 }}>
            关闭
          </Button>
        </div>
      )}

      {pendingConsultations.length === 0 ? (
        <Empty
          description="暂无待接诊的问诊"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={pendingConsultations}
          renderItem={consultation => (
            <List.Item key={consultation.id}>
              <Card
                className="consultation-card"
                hoverable
                actions={[
                  <Tooltip title="查看详情" key="view">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewDetail(consultation)}
                    >
                      详情
                    </Button>
                  </Tooltip>,
                  <Tooltip title="接受问诊" key="accept">
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={acceptingId === consultation.id}
                      onClick={() => handleAcceptConsultation(consultation)}
                    >
                      接受
                    </Button>
                  </Tooltip>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      size={48}
                      src={consultation.patientAvatar}
                      icon={<UserOutlined />}
                    />
                  }
                  title={
                    <div className="consultation-title">
                      <span>{consultation.title}</span>
                      <Tag color={getPriorityColor(consultation.priority)}>
                        {getPriorityText(consultation.priority)}
                      </Tag>
                    </div>
                  }
                  description={
                    <div className="consultation-description">
                      <div className="patient-info">
                        <Text strong>{consultation.patientName}</Text>
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          {consultation.type === 'text'
                            ? '图文问诊'
                            : consultation.type === 'video'
                              ? '视频问诊'
                              : '电话问诊'}
                        </Text>
                      </div>

                      <div className="consultation-content">
                        <Text ellipsis={{ tooltip: consultation.description }}>
                          {consultation.description}
                        </Text>
                      </div>

                      {consultation.symptoms.length > 0 && (
                        <div className="symptoms">
                          <Text type="secondary">症状：</Text>
                          {consultation.symptoms.map((symptom, index) => (
                            <Tag key={index} size="small">
                              {symptom}
                            </Tag>
                          ))}
                        </div>
                      )}

                      {consultation.attachments.length > 0 && (
                        <div className="attachments">
                          <Space>
                            {consultation.attachments.map(attachment => (
                              <Tag
                                key={attachment.id}
                                icon={
                                  attachment.type.startsWith('image/') ? (
                                    <PictureOutlined />
                                  ) : (
                                    <FileTextOutlined />
                                  )
                                }
                                color="blue"
                              >
                                {attachment.name}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      )}

                      <div className="consultation-meta">
                        <Space>
                          <Text type="secondary">
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {formatTime(consultation.createdAt)}
                          </Text>
                          {consultation.estimatedDuration && (
                            <Text type="secondary">
                              预计 {consultation.estimatedDuration} 分钟
                            </Text>
                          )}
                        </Space>
                      </div>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
