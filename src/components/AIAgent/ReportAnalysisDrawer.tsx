// 体检报告智能解读套件 (ReportAnalysisDrawer)
import React, { useState, useEffect } from 'react'
import { Drawer, List, Button, Tag, Space, Typography, Empty, Spin } from 'antd'
import { FilePdfOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons'
import { patientService } from '@/services/patientService'
import { useAIAgentStore } from '@/stores/aiAgentStore'
import type { MedicalReport } from '@/types'

const { Text, Paragraph } = Typography

interface ReportAnalysisDrawerProps {
  visible: boolean
  onClose: () => void
}

export const ReportAnalysisDrawer: React.FC<ReportAnalysisDrawerProps> = ({
  visible,
  onClose,
}) => {
  const { currentPatient, sendMessage } = useAIAgentStore()
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    if (!currentPatient) return
    setLoading(true)
    try {
      const list = await patientService.fetchCustomerReports(currentPatient.id)
      setReports(list)
    } catch (e) {
      console.error('Failed to load reports:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && currentPatient) {
      fetchReports()
    }
  }, [visible, currentPatient])

  const handleTriggerAnalysis = (report: MedicalReport) => {
    const prompt = `请帮我全面深入解读客户 ${currentPatient?.name} 的体检报告「${report.title}」（体检日期: ${report.reportDate || '近期'}，机构: ${report.institution || '未注明'}）。
请执行以下医学分析：
1. 梳理并提取所有阳性指标与异常参考值；
2. 针对高血压、血脂、血糖等代谢指标进行危险度分层评估；
3. 输出初步的生活方式干预、复查时限及用药建议。`

    onClose()
    sendMessage(prompt)
  }

  return (
    <Drawer
      title={
        <Space>
          <FilePdfOutlined style={{ color: '#ff4d4f' }} />
          <span>体检报告智能解读套件 - {currentPatient?.name || '客户'}</span>
        </Space>
      }
      placement="right"
      width={500}
      open={visible}
      onClose={onClose}
      extra={
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchReports}>
          刷新报告
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          点击下方报告的“一键 AI 深度解读”，Agent 将自动读取报告文本并结合客户过往慢病画像完成结构化异常指标萃取与风险评估。
        </Paragraph>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="正在检索本地与云端体检报告..." />
        </div>
      ) : reports.length === 0 ? (
        <Empty description="该客户暂未关联体检报告" />
      ) : (
        <List
          itemLayout="vertical"
          dataSource={reports}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: '16px',
                marginBottom: 12,
                border: '1px solid #f0f0f0',
              }}
              actions={[
                <Button
                  type="primary"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  onClick={() => handleTriggerAnalysis(item)}
                >
                  一键 AI 深度解读
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FilePdfOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />}
                title={<Text strong>{item.title}</Text>}
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      机构：{item.institution || '未知体检机构'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      日期：{item.reportDate || '未知日期'}
                    </Text>
                    <div>
                      <Tag color="blue">{item.status === 'completed' ? '已归档' : '正常'}</Tag>
                    </div>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Drawer>
  )
}
