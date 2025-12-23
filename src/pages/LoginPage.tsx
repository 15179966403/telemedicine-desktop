import React, { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Button,
  Card,
  Tabs,
  message,
  Space,
  Typography,
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  PhoneOutlined,
  SafetyOutlined,
  IdcardOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks'
import { useNavigate } from 'react-router-dom'
import type { LoginCredentials } from '@/types'
import './LoginPage.css'

const { Title, Text } = Typography
const { TabPane } = Tabs

interface LoginFormData {
  username?: string
  password?: string
  phone?: string
  smsCode?: string
  idCard?: string
}

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState<'password' | 'sms' | 'realname'>(
    'password'
  )
  const [smsLoading, setSmsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const { login, loading, error, isAuthenticated, clearError } = useAuth()
  const navigate = useNavigate()

  // 如果已经登录，跳转到工作台
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/workspace')
    }
  }, [isAuthenticated, navigate])

  // 清除错误信息
  useEffect(() => {
    if (error) {
      message.error(error)
      clearError()
    }
  }, [error, clearError])

  // 短信验证码倒计时
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  const handleLogin = async (values: LoginFormData) => {
    try {
      const credentials: LoginCredentials = {
        type: activeTab,
        ...values,
      }

      await login(credentials)
      message.success('登录成功')
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const handleSendSms = async () => {
    const phone = form.getFieldValue('phone')
    if (!phone) {
      message.error('请输入手机号')
      return
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      message.error('请输入正确的手机号')
      return
    }

    setSmsLoading(true)
    try {
      // TODO: 调用发送短信验证码的API
      await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟API调用
      message.success('验证码已发送')
      setCountdown(60)
    } catch (err) {
      message.error('发送验证码失败，请重试')
    } finally {
      setSmsLoading(false)
    }
  }

  const renderPasswordLogin = () => (
    <Form
      form={form}
      name="password-login"
      onFinish={handleLogin}
      autoComplete="off"
      size="large"
    >
      <Form.Item
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少3个字符' },
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入用户名"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少6个字符' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
    </Form>
  )

  const renderSmsLogin = () => (
    <Form
      form={form}
      name="sms-login"
      onFinish={handleLogin}
      autoComplete="off"
      size="large"
    >
      <Form.Item
        name="phone"
        rules={[
          { required: true, message: '请输入手机号' },
          { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
        ]}
      >
        <Input
          prefix={<PhoneOutlined />}
          placeholder="请输入手机号"
          autoComplete="tel"
        />
      </Form.Item>

      <Form.Item
        name="smsCode"
        rules={[
          { required: true, message: '请输入验证码' },
          { len: 6, message: '验证码为6位数字' },
        ]}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Input
            prefix={<SafetyOutlined />}
            placeholder="请输入验证码"
            autoComplete="one-time-code"
            style={{ flex: 1 }}
          />
          <Button
            onClick={handleSendSms}
            loading={smsLoading}
            disabled={countdown > 0}
            style={{ width: '120px' }}
          >
            {countdown > 0 ? `${countdown}s` : '获取验证码'}
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
    </Form>
  )

  const renderRealnameLogin = () => (
    <Form
      form={form}
      name="realname-login"
      onFinish={handleLogin}
      autoComplete="off"
      size="large"
    >
      <Form.Item
        name="idCard"
        rules={[
          { required: true, message: '请输入身份证号' },
          {
            pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/,
            message: '请输入正确的身份证号',
          },
        ]}
      >
        <Input
          prefix={<IdcardOutlined />}
          placeholder="请输入身份证号"
          autoComplete="off"
        />
      </Form.Item>

      <Form.Item>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          首次登录需要进行实名认证，请确保身份证信息准确无误
        </Text>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          实名认证登录
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <div className="login-page">
      <div className="login-container">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2}>互联网医院</Title>
            <Text type="secondary">医生工作台</Text>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={key => {
              setActiveTab(key as typeof activeTab)
              form.resetFields()
            }}
            centered
          >
            <TabPane tab="密码登录" key="password">
              {renderPasswordLogin()}
            </TabPane>
            <TabPane tab="短信登录" key="sms">
              {renderSmsLogin()}
            </TabPane>
            <TabPane tab="实名认证" key="realname">
              {renderRealnameLogin()}
            </TabPane>
          </Tabs>

          <div className="login-footer">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              登录即表示您同意《用户协议》和《隐私政策》
            </Text>
          </div>
        </Card>
      </div>
    </div>
  )
}
