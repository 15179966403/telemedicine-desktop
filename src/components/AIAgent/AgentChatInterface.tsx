// AI 对话交互界面 (采用 @ant-design/x 现代化 AI 组件库升级)
import React, { useState, useRef, useEffect } from 'react'
import {
  Space,
  Typography,
  Tag,
  Button,
  message,
  Tooltip,
} from 'antd'
import {
  Bubble,
  Sender,
  ThoughtChain,
  Prompts,
  Welcome,
} from '@ant-design/x'
import {
  RobotOutlined,
  UserOutlined,
  ThunderboltOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ClearOutlined,
  FileSearchOutlined,
  MedicineBoxOutlined,
  ScheduleOutlined,
  HeartOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useAIAgentStore } from '@/stores/aiAgentStore'
import { ToolConfirmationCard } from './ToolConfirmationCard'

const { Text } = Typography

interface AgentChatInterfaceProps {
  onOpenSettings: () => void
}

export const AgentChatInterface: React.FC<AgentChatInterfaceProps> = ({
  onOpenSettings,
}) => {
  const {
    currentPatient,
    currentSession,
    activeMessages,
    isGenerating,
    streamingContent,
    streamingReasoning,
    pendingConfirmations,
    isApiKeyConfigured,
    sendMessage,
    abortGeneration,
    resolveConfirmation,
    clearCurrentSession,
  } = useAIAgentStore()

  const [inputVal, setInputVal] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [
    activeMessages,
    streamingContent,
    streamingReasoning,
    pendingConfirmations,
    isGenerating,
  ])

  const handleSend = (text?: string) => {
    const content = (text !== undefined ? text : inputVal).trim()
    if (!content || isGenerating) return
    sendMessage(content)
    setInputVal('')
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    message.success('已复制到剪贴板')
  }

  // 快捷提示卡片项
  const promptItems = [
    {
      key: 'report',
      icon: <FileSearchOutlined style={{ color: '#1677ff' }} />,
      label: '解读最新体检报告',
      description: '汇总异常指标、解读潜在慢病风险并提示专科复诊建议',
    },
    {
      key: 'history',
      icon: <MedicineBoxOutlined style={{ color: '#52c41a' }} />,
      label: '整理客户现病史与主诉',
      description: '按照临床规范结构化提炼病情、用药史与关注等级',
    },
    {
      key: 'schedule',
      icon: <ScheduleOutlined style={{ color: '#722ed1' }} />,
      label: '生成个性化随访日程',
      description: '排期未来 3 个月的复查化验与慢病宣教计划',
    },
    {
      key: 'lifestyle',
      icon: <HeartOutlined style={{ color: '#eb2f96' }} />,
      label: '出具生活方式处方',
      description: '定制膳食摄入方案、运动心率区间与自我监测表',
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f8fafc',
      }}
    >
      {/* 顶部现代化状态条 */}
      <div
        style={{
          padding: '12px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #eef2f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <Space size="middle">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1677ff 0%, #36cfc9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
            }}
          >
            <RobotOutlined />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
                {currentSession?.title ||
                  `${currentPatient?.name || '健康客户'} 的专属健康助理`}
              </Text>
              <Tag color="processing" style={{ borderRadius: 10 }}>
                {currentSession?.model || 'deepseek-chat'}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              服务客户：{currentPatient?.name || '未指定'} · 唯一固化 Session
              (纯前端 SQLite 存储)
            </Text>
          </div>
        </Space>

        <Space size="small">
          <Tooltip title="清空当前消息流（保留客户会话）">
            <Button
              type="text"
              icon={<ClearOutlined />}
              size="small"
              onClick={clearCurrentSession}
            >
              清空对话
            </Button>
          </Tooltip>

          {!isApiKeyConfigured ? (
            <Button
              type="primary"
              danger
              size="small"
              icon={<KeyOutlined />}
              onClick={onOpenSettings}
            >
              配置 API Key
            </Button>
          ) : (
            <Tag
              color="success"
              icon={<CheckCircleOutlined />}
              style={{ padding: '2px 8px', borderRadius: 10, cursor: 'pointer' }}
              onClick={onOpenSettings}
            >
              DeepSeek 就绪
            </Tag>
          )}
        </Space>
      </div>

      {/* 消息滚动流 */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* 会话为空时的欢迎 Banner 与快捷指令卡 */}
        {activeMessages.length === 0 && !isGenerating && (
          <div
            style={{
              maxWidth: 720,
              margin: '20px auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <Welcome
              icon={
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background:
                      'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1677ff',
                    fontSize: 26,
                  }}
                >
                  <RobotOutlined />
                </div>
              }
              title={`您好，我是为 ${currentPatient?.name || '当前客户'} 服务的专属健康管理 AI 助理`}
              description="由 DeepSeek 原生大模型驱动。支持体检指标深度解读、人机协同安全工具调度、个性化随访日程与慢病生活方式处方生成。"
            />

            <Prompts
              title="💡 快捷临床与健管指令"
              items={promptItems}
              onItemClick={(item) => {
                const label = item.data.label
                if (typeof label === 'string') {
                  handleSend(label)
                }
              }}
            />
          </div>
        )}

        {/* 历史与当前消息流 */}
        {activeMessages.map((msg) => {
          const isUser = msg.role === 'user'
          const isTool = msg.role === 'tool'

          // 结构化解析工具返回结果
          let toolRenderContent: React.ReactNode = msg.content
          if (isTool && msg.content) {
            try {
              const parsed = JSON.parse(msg.content)
              if (parsed.status === 'cancelled_by_user') {
                toolRenderContent = (
                  <div>
                    <Tag color="warning">医生已取消此操作</Tag>
                    <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>
                      {parsed.message}
                    </div>
                  </div>
                )
              } else if (parsed.status === 'success') {
                toolRenderContent = (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Tag color="success">本地安全指令执行成功</Tag>
                      {parsed.message && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {parsed.message}
                        </Text>
                      )}
                    </div>
                    {parsed.data && (
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px 12px',
                          background: '#f1f5f9',
                          borderRadius: 6,
                          fontSize: 12,
                          maxHeight: 180,
                          overflowY: 'auto',
                          color: '#334155',
                          fontFamily: 'Consolas, Monaco, monospace',
                        }}
                      >
                        {JSON.stringify(parsed.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )
              } else if (parsed.error) {
                toolRenderContent = (
                  <div>
                    <Tag color="error">工具调用失败</Tag>
                    <div style={{ marginTop: 6, color: '#ef4444', fontSize: 13 }}>
                      {parsed.error}
                    </div>
                  </div>
                )
              }
            } catch {
              // 普通文本直接原样展示
            }
          }

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* 若包含 DeepSeek 思考链，使用 ThoughtChain 优雅收折呈现 */}
              {msg.reasoning_content && (
                <div
                  style={{
                    maxWidth: '82%',
                    marginBottom: 8,
                    alignSelf: 'flex-start',
                  }}
                >
                  <ThoughtChain
                    items={[
                      {
                        title: (
                          <Space>
                            <BulbOutlined style={{ color: '#2f54eb' }} />
                            <span>模型深度思考推理过程</span>
                          </Space>
                        ),
                        status: 'success',
                        content: (
                          <div
                            style={{
                              whiteSpace: 'pre-wrap',
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: '#64748b',
                            }}
                          >
                            {msg.reasoning_content}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              )}

              {/* 核心气泡 */}
              <Bubble
                placement={isUser ? 'end' : 'start'}
                variant={isUser ? 'filled' : 'outlined'}
                shape="corner"
                avatar={{
                  icon: isUser ? (
                    <UserOutlined />
                  ) : isTool ? (
                    <ThunderboltOutlined />
                  ) : (
                    <RobotOutlined />
                  ),
                  style: {
                    backgroundColor: isUser
                      ? '#1677ff'
                      : isTool
                      ? '#faad14'
                      : '#52c41a',
                  },
                }}
                header={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {isUser
                      ? '您 (主治医生)'
                      : isTool
                      ? '本地安全工具反馈'
                      : 'AI 临床健管助理'}
                  </Text>
                }
                styles={{
                  content: {
                    borderRadius: isUser
                      ? '16px 16px 2px 16px'
                      : '16px 16px 16px 2px',
                    padding: '12px 18px',
                    fontSize: 14,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    background: isUser
                      ? 'linear-gradient(135deg, #1677ff 0%, #2f54eb 100%)'
                      : isTool
                      ? '#f8fafc'
                      : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    borderColor: isTool ? '#e2e8f0' : '#e8edf3',
                    boxShadow: isUser
                      ? '0 2px 8px rgba(22,119,255,0.2)'
                      : '0 2px 6px rgba(0,0,0,0.03)',
                  },
                }}
                content={isTool ? toolRenderContent : (msg.content || '')}
                footer={
                  !isUser && msg.content ? (
                    <div style={{ marginTop: 4 }}>
                      <Tooltip title="复制内容">
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy(msg.content || '')}
                          style={{ color: '#8c8c8c' }}
                        />
                      </Tooltip>
                    </div>
                  ) : undefined
                }
              />
            </div>
          )
        })}

        {/* 流式推演进行时展示 */}
        {isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 动态思考链 */}
            {streamingReasoning && (
              <div
                style={{
                  maxWidth: '82%',
                  alignSelf: 'flex-start',
                }}
              >
                <ThoughtChain
                  items={[
                    {
                      title: (
                        <Space>
                          <BulbOutlined style={{ color: '#1677ff' }} />
                          <span>AI 正在临床逻辑推演中...</span>
                        </Space>
                      ),
                      status: 'pending',
                      content: (
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: '#64748b',
                          }}
                        >
                          {streamingReasoning}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {/* 动态生成正文气泡 */}
            <Bubble
              placement="start"
              variant="outlined"
              shape="corner"
              avatar={{
                icon: <RobotOutlined />,
                style: { backgroundColor: '#52c41a' },
              }}
              header={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  AI 临床健管助理 (推演生成中)
                </Text>
              }
              loading={!streamingContent}
              content={streamingContent || ''}
              styles={{
                content: {
                  borderRadius: '16px 16px 16px 2px',
                  padding: '12px 18px',
                  fontSize: 14,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  background: '#ffffff',
                  borderColor: '#91caff',
                  boxShadow: '0 2px 8px rgba(22,119,255,0.08)',
                },
              }}
            />
          </div>
        )}

        {/* 待确认的 L2 / L3 人机协同工具卡片 */}
        {pendingConfirmations.map((conf) => (
          <ToolConfirmationCard
            key={conf.confirmationId}
            confirmation={conf}
            onResolve={(allowed) => resolveConfirmation(conf.confirmationId, allowed)}
          />
        ))}
      </div>

      {/* 底部现代化 Sender 输入框 */}
      <div
        style={{
          padding: '16px 24px 20px',
          background: '#ffffff',
          borderTop: '1px solid #eef2f6',
        }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Sender
            value={inputVal}
            onChange={setInputVal}
            onSubmit={(text) => handleSend(text)}
            loading={isGenerating}
            onCancel={abortGeneration}
            placeholder={
              isApiKeyConfigured
                ? `针对 ${currentPatient?.name || '当前客户'} 发送临床问询、指令或病情描述 (Enter 发送，Shift+Enter 换行)...`
                : '请先配置 DeepSeek API Key 即可开始推演...'
            }
            styles={{
              input: {
                minHeight: 44,
                fontSize: 14,
              },
            }}
          />

          <div
            style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              按 <Text keyboard>Enter</Text> 发送 · <Text keyboard>Shift + Enter</Text> 换行 · 本地 SQLite 原子幂等保障
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              支持 L1 自动调度 / L2 报告下载审批 / L3 方案入库人机确认
            </Text>
          </div>
        </div>
      </div>
    </div>
  )
}
