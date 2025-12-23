import React from 'react'
import { Avatar, Button, Image, Tooltip, Tag } from 'antd'
import {
  UserOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  FileOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Message } from '@/types'
import './MessageList.css'

interface MessageListProps {
  messages: Message[]
  onRetryMessage?: (message: Message) => void
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onRetryMessage,
}) => {
  // 渲染消息状态图标
  const renderMessageStatus = (status: Message['status']) => {
    switch (status) {
      case 'sending':
        return <ClockCircleOutlined className="status-sending" />
      case 'sent':
      case 'delivered':
        return <CheckOutlined className="status-sent" />
      case 'failed':
        return <ExclamationCircleOutlined className="status-failed" />
      default:
        return null
    }
  }

  // 渲染消息内容
  const renderMessageContent = (message: Message) => {
    switch (message.type) {
      case 'text':
        return <div className="message-text">{message.content}</div>

      case 'image':
        return (
          <div className="message-image">
            <Image
              src={message.fileInfo?.url || message.content}
              alt="图片消息"
              width={200}
              placeholder={
                <div className="image-placeholder">
                  <FileOutlined />
                  <span>图片加载中...</span>
                </div>
              }
            />
          </div>
        )

      case 'file':
        return (
          <div className="message-file">
            <FileOutlined />
            <div className="file-info">
              <div className="file-name">
                {message.fileInfo?.name || message.content}
              </div>
              <div className="file-size">
                {message.fileInfo?.size
                  ? `${(message.fileInfo.size / 1024).toFixed(1)} KB`
                  : ''}
              </div>
            </div>
            <Button size="small" type="link">
              下载
            </Button>
          </div>
        )

      case 'voice':
        return (
          <div className="message-voice">
            <Button type="primary" shape="circle" size="small">
              ▶
            </Button>
            <span className="voice-duration">0:30</span>
          </div>
        )

      case 'template':
        return (
          <div className="message-template">
            <Tag color="blue">医嘱模板</Tag>
            <div className="template-content">{message.content}</div>
          </div>
        )

      default:
        return <div className="message-text">{message.content}</div>
    }
  }

  // 格式化时间
  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const messageTime = new Date(timestamp)
    const diffInHours =
      (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return formatDistanceToNow(messageTime, {
        addSuffix: true,
        locale: zhCN,
      })
    } else {
      return messageTime.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  return (
    <div className="message-list">
      {messages.map(message => {
        const isDoctor = message.sender === 'doctor'
        const isFailed = message.status === 'failed'

        return (
          <div
            key={message.id}
            className={`message-item ${isDoctor ? 'message-doctor' : 'message-patient'} ${isFailed ? 'message-failed' : ''}`}
          >
            {/* 头像 */}
            <div className="message-avatar">
              <Avatar
                icon={isDoctor ? <MedicineBoxOutlined /> : <UserOutlined />}
                style={{
                  backgroundColor: isDoctor ? '#1890ff' : '#52c41a',
                }}
              />
            </div>

            {/* 消息内容 */}
            <div className="message-content">
              {/* 消息气泡 */}
              <div className="message-bubble">
                {renderMessageContent(message)}

                {/* 消息状态和时间 */}
                <div className="message-meta">
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                  {isDoctor && (
                    <span className="message-status">
                      {renderMessageStatus(message.status)}
                    </span>
                  )}
                </div>
              </div>

              {/* 失败重试按钮 */}
              {isFailed && isDoctor && onRetryMessage && (
                <div className="message-retry">
                  <Tooltip title="重新发送">
                    <Button
                      size="small"
                      type="text"
                      icon={<ReloadOutlined />}
                      onClick={() => onRetryMessage(message)}
                    >
                      重试
                    </Button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
