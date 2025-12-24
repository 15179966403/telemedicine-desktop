import React, { useState, useEffect } from 'react'
import {
  Drawer,
  Descriptions,
  Avatar,
  Tag,
  Space,
  Button,
  Tabs,
  Timeline,
  Card,
  Typography,
  Divider,
  Empty,
  Spin,
} from 'antd'
import {
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { Patient, MedicalRecord, ConsultationSummary } from '@/types'

const { Title, Text, Paragraph } = Typography

interface PatientDetailDrawerProps {
  patient: Patient
  visible: boolean
  onClose: () => void
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patient,
  visible,
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [medicalHistory, setMedicalHistory] = useState<MedicalRecord[]>([])
  const [consultationHistory, setConsultationHistory] = useState<
    ConsultationSummary[]
  >([])

  // 模拟加载患者详细信息
  useEffect(() => {
    if (visible && patient) {
      setLoading(true)
      // 模拟API调用
      setTimeout(() => {
        setMedicalHistory(patient.medicalHistory || [])
        setConsultationHistory([
          {
            id: '1',
            type: 'text',
            status: 'completed',
            diagnosis: '高血压',
            createdAt: new Date('2024-01-15'),
            completedAt: new Date('2024-01-15'),
          },
          {
            id: '2',
            type: 'text',
            status: 'completed',
            diagnosis: '糖尿病复查',
            createdAt: new Date('2024-01-10'),
            completedAt: new Date('2024-01-10'),
          },
        ])
        setLoading(false)
      }, 500)
    }
  }, [visible, patient])

  const renderBasicInfo = () => (
    <Card
      title="基本信息"
      extra={<Button icon={<EditOutlined />}>编辑</Button>}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Avatar
          size={64}
          src={patient.avatar}
          icon={<UserOutlined />}
          style={{ backgroundColor: '#1890ff', marginRight: 16 }}
        />
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {patient.name}
          </Title>
          <Text type="secondary">
            {patient.age}岁 · {patient.gender === 'male' ? '男' : '女'}
          </Text>
        </div>
      </div>

      <Descriptions column={1} size="small">
        <Descriptions.Item label="联系电话" icon={<PhoneOutlined />}>
          {patient.phone}
        </Descriptions.Item>
        <Descriptions.Item label="身份证号">
          {patient.idCard || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="最近就诊">
          {patient.lastVisit
            ? new Date(patient.lastVisit).toLocaleDateString()
            : '暂无记录'}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {patient.createdAt
            ? new Date(patient.createdAt).toLocaleDateString()
            : '未知'}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <div>
        <Text strong>患者标签：</Text>
        <div style={{ marginTop: 8 }}>
          <Space wrap>
            {patient.tags.map(tag => (
              <Tag key={tag} color="blue">
                {tag}
              </Tag>
            ))}
            {patient.tags.length === 0 && (
              <Text type="secondary">暂无标签</Text>
            )}
          </Space>
        </div>
      </div>
    </Card>
  )

  const renderMedicalHistory = () => (
    <Card
      title="病历记录"
      extra={<Button icon={<FileTextOutlined />}>新增病历</Button>}
    >
      {medicalHistory.length > 0 ? (
        <Timeline
          items={medicalHistory.map(record => ({
            dot: <MedicineBoxOutlined style={{ color: '#1890ff' }} />,
            children: (
              <div>
                <Text strong>{record.diagnosis}</Text>
                <br />
                <Text type="secondary">
                  {record.doctorName} ·{' '}
                  {new Date(record.createdAt).toLocaleDateString()}
                </Text>
                <br />
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  症状：{record.symptoms?.join('、') || '无记录'}
                </Paragraph>
                {record.prescription && record.prescription.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong>处方：</Text>
                    {record.prescription.map((med, index) => (
                      <div key={index} style={{ marginLeft: 16 }}>
                        <Text>
                          {med.medicationName} - {med.dosage} - {med.frequency}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      ) : (
        <Empty
          description="暂无病历记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  )

  const renderConsultationHistory = () => (
    <Card title="问诊记录">
      {consultationHistory.length > 0 ? (
        <Timeline
          items={consultationHistory.map(consultation => ({
            color: consultation.status === 'completed' ? 'green' : 'blue',
            children: (
              <div>
                <Space>
                  <Text strong>{consultation.diagnosis || '问诊咨询'}</Text>
                  <Tag
                    color={
                      consultation.type === 'text'
                        ? 'blue'
                        : consultation.type === 'video'
                          ? 'green'
                          : 'orange'
                    }
                  >
                    {consultation.type === 'text'
                      ? '图文问诊'
                      : consultation.type === 'video'
                        ? '视频问诊'
                        : '电话问诊'}
                  </Tag>
                  <Tag
                    color={
                      consultation.status === 'completed'
                        ? 'success'
                        : consultation.status === 'active'
                          ? 'processing'
                          : 'default'
                    }
                  >
                    {consultation.status === 'completed'
                      ? '已完成'
                      : consultation.status === 'active'
                        ? '进行中'
                        : '已取消'}
                  </Tag>
                </Space>
                <br />
                <Text type="secondary">
                  开始时间：{new Date(consultation.createdAt).toLocaleString()}
                </Text>
                {consultation.completedAt && (
                  <>
                    <br />
                    <Text type="secondary">
                      完成时间：
                      {new Date(consultation.completedAt).toLocaleString()}
                    </Text>
                  </>
                )}
              </div>
            ),
          }))}
        />
      ) : (
        <Empty
          description="暂无问诊记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  )

  return (
    <Drawer
      title={`患者详情 - ${patient?.name}`}
      placement="right"
      onClose={onClose}
      open={visible}
      width={600}
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={loading}>
        <div style={{ padding: '24px' }}>
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: renderBasicInfo(),
              },
              {
                key: 'medical',
                label: '病历记录',
                children: renderMedicalHistory(),
              },
              {
                key: 'consultation',
                label: '问诊记录',
                children: renderConsultationHistory(),
              },
            ]}
          />
        </div>
      </Spin>
    </Drawer>
  )
}
