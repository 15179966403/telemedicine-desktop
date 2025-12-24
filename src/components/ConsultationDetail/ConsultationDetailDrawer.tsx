import React, { useState } from 'react'
import {
  Drawer,
  Descriptions,
  Tag,
  Avatar,
  Space,
  Button,
  Typography,
  Divider,
  Image,
  Modal,
  Input,
  message as antMessage,
} from 'antd'
import {
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CheckOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useConsultationStore } from '@/stores/consultationStore'
import { useWindowStore } from '@/stores/windowStore'
import type { Consultation, FileInfo } from '@/types'
import './ConsultationDetailDrawer.css'

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

interface ConsultationDetailDrawerProps {
  visible: boolean
  consultation: Consultation | null
  onClose: () => void
}

export const ConsultationDetailDrawer: React.FC<
  ConsultationDetailDrawerProps
> = ({ visible, consultation, onClose }) => {
  const { acceptConsultation, completeConsultation, loading } =
    useConsultationStore()

  const { createWindow } = useWindowStore()

  const [completionModalVisible, setCompletionModalVisible] = useState(false)
  const [completionSummary, setCompletionSummary] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  if (!consultation) {
    return null
  }

  // 获取状态颜色
  const getStatusColor = (status: Consultation['status']) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'active':
        return 'green'
      case 'completed':
        return 'blue'
      case 'cancelled':
        return 'red'
      case 'expired':
        return 'gray'
      default:
        return 'default'
    }
  }

  // 获取状态文本
  const getStatusText = (status: Consultation['status']) => {
    switch (status) {
      case 'pending':
        return '待接诊'
      case 'active':
        return '进行中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      case 'expired':
        return '已过期'
      default:
        return status
    }
  }

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
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 接受问诊
  const handleAcceptConsultation = async () => {
    try {
      setActionLoading(true)
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
      onClose()
    } catch (error) {
      antMessage.error('接受问诊失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 开始聊天
  const handleStartChat = async () => {
    try {
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

      onClose()
    } catch (error) {
      antMessage.error('打开聊天窗口失败')
    }
  }

  // 完成问诊
  const handleCompleteConsultation = () => {
    setCompletionModalVisible(true)
  }

  // 确认完成问诊
  const handleConfirmComplete = async () => {
    try {
      setActionLoading(true)
      await completeConsultation(consultation.id, completionSummary)

      antMessage.success('问诊已完成')
      setCompletionModalVisible(false)
      setCompletionSummary('')
      onClose()
    } catch (error) {
      antMessage.error('完成问诊失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 渲染附件
  const renderAttachment = (attachment: unknown) => {
    const isImage = attachment.type.startsWith('image/')

    return (
      <div key={attachment.id} className="attachment-item">
        {isImage ? (
          <div className="image-attachment">
            <Image
              width={100}
              height={100}
              src={attachment.url}
              alt={attachment.name}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
            <Text className="attachment-name">{attachment.name}</Text>
          </div>
        ) : (
          <div className="file-attachment">
            <FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Text className="attachment-name">{attachment.name}</Text>
            <Text type="secondary" className="attachment-size">
              {(attachment.size / 1024).toFixed(1)} KB
            </Text>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Drawer
        title="问诊详情"
        placement="right"
        width={600}
        open={visible}
        onClose={onClose}
        className="consultation-detail-drawer"
        extra={
          <Space>
            {consultation.status === 'pending' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={actionLoading}
                onClick={handleAcceptConsultation}
              >
                接受问诊
              </Button>
            )}
            {consultation.status === 'active' && (
              <>
                <Button icon={<MessageOutlined />} onClick={handleStartChat}>
                  开始聊天
                </Button>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleCompleteConsultation}
                >
                  完成问诊
                </Button>
              </>
            )}
          </Space>
        }
      >
        <div className="consultation-detail-content">
          {/* 基本信息 */}
          <div className="section">
            <Title level={4}>基本信息</Title>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="问诊ID">
                {consultation.id}
              </Descriptions.Item>
              <Descriptions.Item label="患者">
                <Space>
                  <Avatar
                    size={32}
                    src={consultation.patientAvatar}
                    icon={<UserOutlined />}
                  />
                  <Text strong>{consultation.patientName}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="问诊类型">
                <Tag color="blue">
                  {consultation.type === 'text'
                    ? '图文问诊'
                    : consultation.type === 'video'
                      ? '视频问诊'
                      : '电话问诊'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(consultation.status)}>
                  {getStatusText(consultation.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={getPriorityColor(consultation.priority)}>
                  {getPriorityText(consultation.priority)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                <Space>
                  <ClockCircleOutlined />
                  {formatDateTime(consultation.createdAt)}
                </Space>
              </Descriptions.Item>
              {consultation.estimatedDuration && (
                <Descriptions.Item label="预计时长">
                  {consultation.estimatedDuration} 分钟
                </Descriptions.Item>
              )}
              {consultation.completedAt && (
                <Descriptions.Item label="完成时间">
                  <Space>
                    <ClockCircleOutlined />
                    {formatDateTime(consultation.completedAt)}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          <Divider />

          {/* 问诊内容 */}
          <div className="section">
            <Title level={4}>问诊内容</Title>
            <div className="consultation-title">
              <Title level={5}>{consultation.title}</Title>
            </div>
            <Paragraph>{consultation.description}</Paragraph>
          </div>

          {/* 症状信息 */}
          {consultation.symptoms.length > 0 && (
            <>
              <Divider />
              <div className="section">
                <Title level={4}>症状信息</Title>
                <Space wrap>
                  {consultation.symptoms.map((symptom, index) => (
                    <Tag key={index} color="orange">
                      {symptom}
                    </Tag>
                  ))}
                </Space>
              </div>
            </>
          )}

          {/* 附件信息 */}
          {consultation.attachments.length > 0 && (
            <>
              <Divider />
              <div className="section">
                <Title level={4}>附件信息</Title>
                <div className="attachments-grid">
                  {consultation.attachments.map(renderAttachment)}
                </div>
              </div>
            </>
          )}

          {/* 最后消息 */}
          {consultation.lastMessage && (
            <>
              <Divider />
              <div className="section">
                <Title level={4}>最新消息</Title>
                <div className="last-message">
                  <Text type="secondary">
                    {consultation.lastMessage.sender === 'doctor'
                      ? '医生'
                      : '患者'}
                    {' · '}
                    {formatDateTime(consultation.lastMessage.timestamp)}
                  </Text>
                  <Paragraph style={{ marginTop: 8 }}>
                    {consultation.lastMessage.content}
                  </Paragraph>
                </div>
              </div>
            </>
          )}
        </div>
      </Drawer>

      {/* 完成问诊模态框 */}
      <Modal
        title="完成问诊"
        open={completionModalVisible}
        onOk={handleConfirmComplete}
        onCancel={() => {
          setCompletionModalVisible(false)
          setCompletionSummary('')
        }}
        confirmLoading={actionLoading}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>请填写问诊总结（可选）：</Text>
        </div>
        <TextArea
          value={completionSummary}
          onChange={e => setCompletionSummary(e.target.value)}
          placeholder="请输入问诊总结，包括诊断结果、治疗建议等..."
          rows={6}
          maxLength={1000}
          showCount
        />
      </Modal>
    </>
  )
}
