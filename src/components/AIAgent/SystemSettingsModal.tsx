// 系统设置弹窗 (DeepSeek API Key 与模型端点安全配置)
import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Button,
  Alert,
  Tag,
  Space,
  Select,
  message,
} from 'antd'
import {
  KeyOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { aiService, DEFAULT_BASE_URL, DEFAULT_MODEL } from '@/services/ai/aiService'
import { useAIAgentStore } from '@/stores/aiAgentStore'

interface SystemSettingsModalProps {
  visible: boolean
  onClose: () => void
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [hasConfigured, setHasConfigured] = useState(false)
  const { checkApiKeyStatus } = useAIAgentStore()

  useEffect(() => {
    if (visible) {
      setTestResult(null)
      aiService.getAIConfig().then((cfg) => {
        setHasConfigured(cfg.has_configured)
        form.setFieldsValue({
          baseUrl: cfg.base_url || DEFAULT_BASE_URL,
          model: cfg.model || DEFAULT_MODEL,
        })
      })
    }
  }, [visible, form])

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['apiKey', 'baseUrl', 'model'])
      const inputKey = values.apiKey ? values.apiKey.trim() : ''

      if (!inputKey && !hasConfigured) {
        message.warning('请先输入有效的 DeepSeek API Key')
        return
      }

      setTesting(true)
      setTestResult(null)

      const resultMsg = await aiService.testConnection({
        apiKey: inputKey || undefined,
        baseUrl: values.baseUrl?.trim(),
        model: values.model?.trim(),
      })

      setTestResult({
        success: true,
        message: resultMsg,
      })
      message.success('DeepSeek 接口连接验证成功！')
    } catch (err: any) {
      const errMsg = err?.message || '连接测试异常，请检查网络或参数'
      setTestResult({
        success: false,
        message: errMsg,
      })
      message.error(errMsg)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      await aiService.saveAIConfig({
        apiKey: values.apiKey?.trim() || undefined,
        baseUrl: values.baseUrl?.trim() || DEFAULT_BASE_URL,
        model: values.model?.trim() || DEFAULT_MODEL,
      })

      message.success('AI Agent 参数已安全加密保存至本地')
      await checkApiKeyStatus()
      setHasConfigured(true)
      form.resetFields(['apiKey'])
      onClose()
    } catch (err: any) {
      if (err.errorFields) return
      message.error(err.message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
          <span>系统参数与 AI Agent 配置</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving || testing}>
          取消
        </Button>,
        <Button
          key="test"
          icon={<ApiOutlined />}
          loading={testing}
          onClick={handleTestConnection}
          disabled={saving}
        >
          测试连接
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={saving}
          onClick={handleSave}
          disabled={testing}
        >
          保存并加密存储
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          message="DeepSeek 官方规范与本地客户端安全说明"
          description="输入的 API Key 仅保存在本机桌面客户端，经由底层 AES-GCM 安全加密存储。请求直接由本地 Native 通道与 DeepSeek 官方接口安全交互，绝不经过任何第三方中转服务器。"
        />
      </div>

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <span>当前密钥状态：</span>
          {hasConfigured ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已就绪 (已安全加密存储)
            </Tag>
          ) : (
            <Tag color="warning">未配置 (无法使用 AI 功能)</Tag>
          )}
        </Space>
      </div>

      {testResult && (
        <div style={{ marginBottom: 16 }}>
          <Alert
            type={testResult.success ? 'success' : 'error'}
            showIcon
            message={testResult.success ? '连接测试成功' : '连接测试失败'}
            description={testResult.message}
            closable
            onClose={() => setTestResult(null)}
          />
        </div>
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          label="DeepSeek API Key"
          name="apiKey"
          rules={[
            {
              required: !hasConfigured,
              message: '请输入有效的 DeepSeek API Key',
            },
          ]}
          extra="可在 DeepSeek 开放平台 (platform.deepseek.com) 控制台生成。"
        >
          <Input.Password
            placeholder={
              hasConfigured ? '如需更换密钥，请输入新 API Key；不改请留空' : 'sk-...'
            }
            prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
          />
        </Form.Item>

        <Form.Item
          label="API 基础服务地址 (Base URL)"
          name="baseUrl"
          rules={[{ required: true, message: '请输入 API 基础接口地址' }]}
          extra="官方主节点: https://api.deepseek.com/v1 (或 https://api.deepseek.com)"
        >
          <Input
            placeholder="https://api.deepseek.com/v1"
            prefix={<ApiOutlined style={{ color: '#bfbfbf' }} />}
          />
        </Form.Item>

        <Form.Item
          label="驱动模型 (Model)"
          name="model"
          rules={[{ required: true, message: '请选择或输入模型标识' }]}
          extra="官方标准模型：deepseek-chat 对应 DeepSeek-V3 (支持工具调用与流式推理)；deepseek-reasoner 对应 DeepSeek-R1 (深度思维链思考)。"
        >
          <Select
            options={[
              {
                value: 'deepseek-chat',
                label: (
                  <Space>
                    <span>deepseek-chat</span>
                    <Tag color="blue">默认推荐 / DeepSeek-V3 / 临床推理与工具调用</Tag>
                  </Space>
                ),
              },
              {
                value: 'deepseek-reasoner',
                label: (
                  <Space>
                    <span>deepseek-reasoner</span>
                    <Tag color="purple">DeepSeek-R1 / 深度思考长思维链</Tag>
                  </Space>
                ),
              },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
