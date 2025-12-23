import React, { useState, useRef, useEffect } from 'react'
import {
  Input,
  Button,
  Upload,
  message as antMessage,
  Spin,
  Empty,
  Tooltip,
  Popover,
} from 'antd'
import {
  SendOutlined,
  PaperClipOutlined,
  SmileOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMessages } from '@/hooks/useMessages'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { MedicalTemplates } from './MedicalTemplates'
import type { Message, MessageType } from '@/types'
import './ChatInterface.css'

interface ChatInterfaceProps {
  consultationId: string
  patientName: string
  onClose?: () => void
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  consultationId,
  patientName,
  onClose,
}) => {
  const {
    messages,
    loading,
    loadingMore,
    error,
    hasMoreMessages,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    sendFileMessage,
    clearError,
    connectionStatus,
    retryAllFailedMessages,
    syncAllMessages,
  } = useMessages(consultationId)

  const [inputValue, setInputValue] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 发送文本消息
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const messageData: Omit<Message, 'id' | 'timestamp' | 'status'> = {
      consultationId,
      type: 'text',
      content: inputValue.trim(),
      sender: 'doctor',
    }

    try {
      await sendMessage(messageData)
      setInputValue('')
      inputRef.current?.focus()
    } catch (error) {
      antMessage.error('发送消息失败')
    }
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      await sendFileMessage(file)
      antMessage.success('文件发送成功')
    } catch (error) {
      antMessage.error('文件发送失败')
    } finally {
      setIsUploading(false)
    }
  }

  // 使用医嘱模板
  const handleUseTemplate = (template: string) => {
    setInputValue(template)
    setShowTemplates(false)
    inputRef.current?.focus()
  }

  // 重试失败的消息
  const handleRetryMessage = async (message: Message) => {
    try {
      await retryMessage(message)
      antMessage.success('消息重发成功')
    } catch (error) {
      antMessage.error('消息重发失败')
    }
  }

  // 加载更多历史消息
  const handleLoadMore = async () => {
    try {
      await loadMoreMessages()
    } catch (error) {
      antMessage.error('加载历史消息失败')
    }
  }

  return (
    <div className="chat-interface">
      {/* 聊天头部 */}
      <div className="chat-header">
        <div className="chat-title">
          <h3>与 {patientName} 的对话</h3>
          <span className="consultation-id">问诊ID: {consultationId}</span>
        </div>
        <div className="chat-actions">
          <Tooltip title="刷新消息">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => syncAllMessages()}
              loading={loading}
            />
          </Tooltip>
          {onClose && <Button onClick={onClose}>关闭</Button>}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="chat-error">
          <span>{error}</span>
          <Button size="small" onClick={clearError}>
            关闭
          </Button>
        </div>
      )}

      {/* 消息列表 */}
      <div className="chat-messages">
        {loading && messages.length === 0 ? (
          <div className="chat-loading">
            <Spin size="large" />
            <p>加载消息中...</p>
          </div>
        ) : messages.length === 0 ? (
          <Empty description="暂无消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            {messages.length >= 20 && hasMoreMessages && (
              <div className="load-more">
                <Button
                  type="link"
                  onClick={handleLoadMore}
                  loading={loadingMore}
                  disabled={!hasMoreMessages}
                >
                  {loadingMore ? '加载中...' : '加载更多历史消息'}
                </Button>
              </div>
            )}
            <MessageList
              messages={messages}
              onRetryMessage={handleRetryMessage}
            />
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 消息输入区域 */}
      <div className="chat-input-area">
        {/* 工具栏 */}
        <div className="chat-toolbar">
          <Upload
            beforeUpload={file => {
              handleFileUpload(file)
              return false // 阻止默认上传行为
            }}
            showUploadList={false}
            accept="image/*,.pdf,.doc,.docx"
          >
            <Button
              icon={<PaperClipOutlined />}
              loading={isUploading}
              disabled={isUploading}
            >
              {isUploading ? '上传中...' : '附件'}
            </Button>
          </Upload>

          <Popover
            content={
              <MedicalTemplates
                onSelectTemplate={handleUseTemplate}
                onClose={() => setShowTemplates(false)}
              />
            }
            title="常用医嘱模板"
            trigger="click"
            open={showTemplates}
            onOpenChange={setShowTemplates}
            placement="topLeft"
          >
            <Button icon={<SmileOutlined />}>模板</Button>
          </Popover>
        </div>

        {/* 输入框 */}
        <div className="chat-input">
          <Input.TextArea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息内容..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || loading}
            loading={loading}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
