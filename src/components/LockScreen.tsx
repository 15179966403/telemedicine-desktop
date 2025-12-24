// 锁屏组件

import { useState } from 'react'
import { Modal, Input, Button, Typography, Space } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useSecurity } from '../hooks/useSecurity'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

interface LockScreenProps {
  onUnlock?: () => void
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { isLocked, unlockScreen } = useSecurity()
  const { user } = useAuthStore()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUnlock = async () => {
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 这里应该调用认证服务验证密码
      // 为了演示，我们简单模拟验证
      await new Promise(resolve => setTimeout(resolve, 500))

      // 验证成功
      unlockScreen()
      setPassword('')
      onUnlock?.()
    } catch (err) {
      setError('密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock()
    }
  }

  return (
    <Modal
      open={isLocked}
      closable={false}
      footer={null}
      maskClosable={false}
      centered
      width={400}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <Title level={3} style={{ marginTop: 16 }}>
            屏幕已锁定
          </Title>
          <Text type="secondary">{user?.name || '用户'}，请输入密码解锁</Text>
        </div>

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.Password
            size="large"
            placeholder="请输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            prefix={<LockOutlined />}
            status={error ? 'error' : ''}
          />
          {error && <Text type="danger">{error}</Text>}

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleUnlock}
          >
            解锁
          </Button>
        </Space>
      </Space>
    </Modal>
  )
}
