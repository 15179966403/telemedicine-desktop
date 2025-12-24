import React, { useState } from 'react'
import { Layout, Tabs, Typography } from 'antd'
import {
  ClockCircleOutlined,
  MessageOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { PendingConsultationList } from '@/components/ConsultationList/PendingConsultationList'
import { ConsultationDetailDrawer } from '@/components/ConsultationDetail/ConsultationDetailDrawer'
import { useConsultationStore } from '@/stores/consultationStore'
import type { Consultation } from '@/types'

const { Header, Content } = Layout
const { Title } = Typography
const { TabPane } = Tabs

export const ConsultationManagementPage: React.FC = () => {
  const { pendingConsultations, activeConsultations, completedConsultations } =
    useConsultationStore()

  const [selectedConsultation, setSelectedConsultation] =
    useState<Consultation | null>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)

  // 处理选择问诊
  const handleSelectConsultation = (consultation: Consultation) => {
    setSelectedConsultation(consultation)
    setDetailDrawerVisible(true)
  }

  // 关闭详情抽屉
  const handleCloseDetailDrawer = () => {
    setDetailDrawerVisible(false)
    setSelectedConsultation(null)
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
        }}
      >
        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
          问诊管理
        </Title>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Tabs defaultActiveKey="pending" size="large">
          <TabPane
            tab={
              <span>
                <ClockCircleOutlined />
                待接诊 ({pendingConsultations.length})
              </span>
            }
            key="pending"
          >
            <PendingConsultationList
              onSelectConsultation={handleSelectConsultation}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <MessageOutlined />
                进行中 ({activeConsultations.length})
              </span>
            }
            key="active"
          >
            <div
              style={{ padding: '40px', textAlign: 'center', color: '#666' }}
            >
              <MessageOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>进行中的问诊列表功能开发中...</p>
            </div>
          </TabPane>

          <TabPane
            tab={
              <span>
                <CheckCircleOutlined />
                已完成 ({completedConsultations.length})
              </span>
            }
            key="completed"
          >
            <div
              style={{ padding: '40px', textAlign: 'center', color: '#666' }}
            >
              <CheckCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>已完成的问诊列表功能开发中...</p>
            </div>
          </TabPane>
        </Tabs>
      </Content>

      {/* 问诊详情抽屉 */}
      <ConsultationDetailDrawer
        visible={detailDrawerVisible}
        consultation={selectedConsultation}
        onClose={handleCloseDetailDrawer}
      />
    </Layout>
  )
}
