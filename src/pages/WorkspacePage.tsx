import React from 'react'
import { Layout, Button, Typography, Space } from 'antd'
import { LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks'

const { Header, Content } = Layout
const { Title, Text } = Typography

export const WorkspacePage: React.FC = () => {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
          互联网医院 - 工作台
        </Title>

        <Space>
          <Space>
            <UserOutlined />
            <Text>{user?.name || '医生'}</Text>
            <Text type="secondary">({user?.department})</Text>
          </Space>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <div
          style={{
            background: '#fff',
            padding: '24px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <Title level={3}>欢迎使用互联网医院工作台</Title>
          <Text type="secondary">
            认证系统已成功实现，您可以开始使用系统功能
          </Text>
        </div>
      </Content>
    </Layout>
  )
}
