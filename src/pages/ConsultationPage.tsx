import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Layout, Typography, Spin, message as antMessage } from 'antd'
import { ChatInterface } from '@/components/ChatInterface'
import { BackButton } from '@/components/BackButton'
import { useConsultationStore } from '@/stores/consultationStore'
import type { Consultation } from '@/types'

const { Header, Content } = Layout
const { Title } = Typography

export const ConsultationPage: React.FC = () => {
  const { consultationId } = useParams<{ consultationId: string }>()
  const { selectedConsultation, fetchConsultationDetail, loading, error } =
    useConsultationStore()

  const [consultation, setConsultation] = useState<Consultation | null>(null)

  useEffect(() => {
    if (consultationId) {
      fetchConsultationDetail(consultationId)
    }
  }, [consultationId, fetchConsultationDetail])

  useEffect(() => {
    if (selectedConsultation) {
      setConsultation(selectedConsultation)
    }
  }, [selectedConsultation])

  if (loading) {
    return (
      <Layout style={{ height: '100vh' }}>
        <Content
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
          }}
        >
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>加载问诊信息中...</p>
        </Content>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout style={{ height: '100vh' }}>
        <Content
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
          }}
        >
          <Title level={4} type="danger">
            加载失败
          </Title>
          <p>{error}</p>
        </Content>
      </Layout>
    )
  }

  if (!consultation) {
    return (
      <Layout style={{ height: '100vh' }}>
        <Content
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
          }}
        >
          <Title level={4}>问诊不存在</Title>
          <p>未找到指定的问诊信息</p>
        </Content>
      </Layout>
    )
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          height: '48px',
          lineHeight: '48px',
        }}
      >
        <BackButton to="/consultations" />
      </Header>
      <Content style={{ padding: 0, height: 'calc(100vh - 48px)' }}>
        <ChatInterface
          consultationId={consultation.id}
          patientName={consultation.patientName}
        />
      </Content>
    </Layout>
  )
}

export default ConsultationPage
