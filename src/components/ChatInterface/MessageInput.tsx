import React, { useState, useRef } from 'react'
import { Input, Button, Upload, message as antMessage } from 'antd'
import { SendOutlined, PaperClipOutlined } from '@ant-design/icons'
import type { Message } from '@/types'

interface MessageInputProps {
  onSendMessage: (
    message: Omit<Message, 'id' | 'timestamp' | 'status'>
  ) => Promise<void>
  onFileUpload: (file: File) => Promise<void>
  disabled?: boolean
  loading?: boolean
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onFileUpload,
  disabled = false,
  loading = false,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<any>(null)

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim()) return

    try {
      await onSendMessage({
        consultationId: '', // 这个会在父组件中设置
        type: 'text',
        content: inputValue.trim(),
        sender: 'doctor',
      })
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
      handleSend()
    }
  }

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    // 验证文件类型和大小
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
    ]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      antMessage.error('不支持的文件类型')
      return false
    }

    if (file.size > maxSize) {
      antMessage.error('文件大小不能超过10MB')
      return false
    }

    setIsUploading(true)
    try {
      await onFileUpload(file)
      antMessage.success('文件上传成功')
    } catch (error) {
      antMessage.error('文件上传失败')
    } finally {
      setIsUploading(false)
    }

    return false // 阻止默认上传行为
  }

  return (
    <div className="message-input">
      <div className="input-toolbar">
        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          accept="image/*,.pdf,.doc,.docx"
        >
          <Button
            icon={<PaperClipOutlined />}
            loading={isUploading}
            disabled={disabled || isUploading}
          >
            {isUploading ? '上传中...' : '附件'}
          </Button>
        </Upload>
      </div>

      <div className="input-area">
        <Input.TextArea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息内容..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={disabled || loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputValue.trim() || disabled || loading}
          loading={loading}
        >
          发送
        </Button>
      </div>
    </div>
  )
}
