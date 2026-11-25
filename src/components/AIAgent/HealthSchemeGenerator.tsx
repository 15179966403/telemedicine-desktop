// 随访与健康管理方案拟定套件 (HealthSchemeGenerator)
import React from 'react'
import { Drawer, Button, Space, Typography, Card, Form, Select } from 'antd'
import { ScheduleOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAIAgentStore } from '@/stores/aiAgentStore'

const { Text, Paragraph } = Typography

interface HealthSchemeGeneratorProps {
  visible: boolean
  onClose: () => void
}

export const HealthSchemeGenerator: React.FC<HealthSchemeGeneratorProps> = ({
  visible,
  onClose,
}) => {
  const { currentPatient, currentSession, sendMessage } = useAIAgentStore()
  const [form] = Form.useForm()

  const handleGenerate = () => {
    form.validateFields().then((values) => {
      const prompt = `请基于我们此前对客户 ${currentPatient?.name} 的全部对话与体检诊断结论，正式为该客户输出一份规范严谨的《个人健康管理与慢病随访方案》。
重点偏向：${values.focusArea || '全面综合健康管理'}
随访周期：${values.period || '1个月内'}

【输出格式规范】:
# 《客户个性化健康管理干预方案》
## 一、 客户健康现状与风险评估
## 二、 膳食与生活方式干预处方（具体到日摄入指标与运动频次）
## 三、 家居自测监测指标目标值（血压/心率/血糖控制线）
## 四、 随访复查建议与异常预警指南`

      onClose()
      sendMessage(prompt)
    })
  }

  return (
    <Drawer
      title={
        <Space>
          <ScheduleOutlined style={{ color: '#52c41a' }} />
          <span>健康管理与随访方案智能拟定 - {currentPatient?.name || '客户'}</span>
        </Space>
      }
      placement="right"
      width={480}
      open={visible}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
            生成标准化方案
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          Agent 将结合该客户唯一的历史持久会话记忆（包含已提炼的医疗摘要和体检指标），一键提炼生成结构化的干预处方。
        </Paragraph>
      </div>

      <Card size="small" style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text strong>已关联客户专属记忆</Text>
        </Space>
        <div style={{ marginTop: 8, fontSize: 12, color: '#595959' }}>
          {currentSession?.rolling_summary ? (
            <Text ellipsis={{ tooltip: currentSession.rolling_summary }}>
              已就绪：{currentSession.rolling_summary.slice(0, 80)}...
            </Text>
          ) : (
            '当前会话尚未生成滚动摘要，Agent 将直接基于全部活跃上下文生成。'
          )}
        </div>
      </Card>

      <Form form={form} layout="vertical" initialValues={{ focusArea: '三高与代谢综合征管理', period: '1个月随访' }}>
        <Form.Item label="干预方案侧重领域" name="focusArea">
          <Select
            options={[
              { label: '三高与代谢综合征综合管理', value: '三高与代谢综合征管理' },
              { label: '心脑血管疾病二级预防', value: '心脑血管疾病二级预防' },
              { label: '减重与脂肪肝营养逆转', value: '减重与脂肪肝营养逆转' },
              { label: '老年衰弱与慢病综合随访', value: '老年衰弱与慢病综合随访' },
            ]}
          />
        </Form.Item>

        <Form.Item label="预期随访周期" name="period">
          <Select
            options={[
              { label: '2周严密随访', value: '2周严密随访' },
              { label: '1个月定期随访', value: '1个月定期随访' },
              { label: '3个月季度评估', value: '3个月季度评估' },
            ]}
          />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
