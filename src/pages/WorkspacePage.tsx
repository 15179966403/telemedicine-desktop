import React from 'react'
import { Layout, Button, Typography, Space, Card, Row, Col } from 'antd'
import {
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  MessageOutlined,
  SettingOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/hooks'
import { useNavigate } from 'react-router-dom'

const { Header, Content } = Layout
const { Title, Text } = Typography

export const WorkspacePage: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
  }

  const handleNavigateToPatients = () => {
    navigate('/patients')
  }

  const handleNavigateToConsultations = () => {
    navigate('/consultations')
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
        <div style={{ marginBottom: 24 }}>
          <Title level={3}>欢迎使用互联网医院工作台</Title>
          <Text type="secondary">选择下方功能模块开始您的工作</Text>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: 200 }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
              }}
              onClick={handleNavigateToPatients}
            >
              <TeamOutlined
                style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                患者管理
              </Title>
              <Text type="secondary">查看和管理患者信息</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: 200 }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
              }}
              onClick={handleNavigateToConsultations}
            >
              <MessageOutlined
                style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                在线问诊
              </Title>
              <Text type="secondary">处理患者问诊请求</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: 200 }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <BarChartOutlined
                style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                数据统计
              </Title>
              <Text type="secondary">查看工作统计数据</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: 200 }}
              bodyStyle={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <SettingOutlined
                style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                系统设置
              </Title>
              <Text type="secondary">配置系统参数</Text>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  )
}

export default WorkspacePage
