// AI 个人智能体工作台主页面 (AIAgentWorkspacePage)
import React, { useState, useEffect } from 'react'
import {
  Layout,
  Input,
  List,
  Avatar,
  Tag,
  Typography,
  Space,
  Button,
  Drawer,
  Table,
  Badge,
} from 'antd'
import {
  UserOutlined,
  PhoneOutlined,
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  FilePdfOutlined,
  ScheduleOutlined,
  HistoryOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { BackButton } from '@/components/BackButton'
import { useAIAgentStore } from '@/stores/aiAgentStore'
import { patientService } from '@/services/patientService'
import { AgentChatInterface } from '@/components/AIAgent/AgentChatInterface'
import { ReportAnalysisDrawer } from '@/components/AIAgent/ReportAnalysisDrawer'
import { HealthSchemeGenerator } from '@/components/AIAgent/HealthSchemeGenerator'
import { SystemSettingsModal } from '@/components/AIAgent/SystemSettingsModal'
import type { Patient } from '@/types'

const { Header, Sider, Content } = Layout
const { Title, Text, Paragraph } = Typography

const DEMO_PATIENTS: Patient[] = [
  {
    id: 'demo_101',
    customerId: 'C1001',
    name: '张建国 (示范客户)',
    age: 48,
    gender: 'male',
    phone: '13912345678',
    tags: ['高血压', '脂肪肝', '高尿酸'],
    vipName: '白金VIP',
    companyName: '远大科技集团',
    ownerPhysicianName: '李主任',
    medicalHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'demo_102',
    customerId: 'C1002',
    name: '王丽华 (示范客户)',
    age: 42,
    gender: 'female',
    phone: '13887654321',
    tags: ['甲状腺结节', '骨质疏松风险'],
    vipName: '黄金VIP',
    companyName: '中创融汇金融',
    ownerPhysicianName: '张副主任',
    medicalHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'demo_103',
    customerId: 'C1003',
    name: '陈明远 (示范客户)',
    age: 56,
    gender: 'male',
    phone: '13766668888',
    tags: ['空腹高血糖', '冠心病待排'],
    vipName: '钻石VIP',
    companyName: '恒信资产控股',
    ownerPhysicianName: '王专家',
    medicalHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

export const AIAgentWorkspacePage: React.FC = () => {
  const {
    currentPatient,
    currentSession,
    toolAudits,
    checkApiKeyStatus,
    setCurrentPatient,
    refreshToolAudits,
  } = useAIAgentStore()

  const [patients, setPatients] = useState<Patient[]>([])
  const [searchName, setSearchName] = useState('')
  const [searchPhone, setSearchPhone] = useState('')
  const [loadingPatients, setLoadingPatients] = useState(false)

  // 弹窗与抽屉控制
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false)
  const [schemeDrawerOpen, setSchemeDrawerOpen] = useState(false)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false)

  // 加载客户列表 (支持姓名与手机号独立条件检索)
  const loadPatients = async (name?: string, phone?: string) => {
    setLoadingPatients(true)
    try {
      const res = await patientService.getPatientList({
        customerName: name ? name.trim() : undefined,
        mobile: phone ? phone.trim() : undefined,
        page: 1,
        pageSize: 50,
      })
      let list = res.patients || []
      if (list.length === 0 && !name && !phone) {
        // 后台无数据或离线时自动载入高质量示范客户，确保随时可用
        list = DEMO_PATIENTS
      }
      setPatients(list)
      // 如果未选定客户且有客户数据，默认选第一个
      if (!currentPatient && list.length > 0) {
        setCurrentPatient(list[0])
      }
    } catch (e) {
      console.warn('Failed to load patient list, fallback to demo patients:', e)
      if (!name && !phone) {
        setPatients(DEMO_PATIENTS)
        if (!currentPatient) {
          setCurrentPatient(DEMO_PATIENTS[0])
        }
      } else {
        setPatients([])
      }
    } finally {
      setLoadingPatients(false)
    }
  }

  const handleSearch = () => {
    loadPatients(searchName, searchPhone)
  }

  const handleReset = () => {
    setSearchName('')
    setSearchPhone('')
    loadPatients('', '')
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
    checkApiKeyStatus()
    loadPatients()
  }, [])

  const filteredPatients = patients.filter((p) => {
    if (!p) return false
    const nameMatch = !searchName.trim() || (p.name || '').toLowerCase().includes(searchName.trim().toLowerCase())
    const phoneMatch = !searchPhone.trim() || (p.phone || '').includes(searchPhone.trim())
    return nameMatch && phoneMatch
  })

  return (
    <Layout style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航 */}
      <Header
        style={{
          background: '#fff',
          padding: '0 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          height: 56,
          lineHeight: '56px',
          flexShrink: 0,
        }}
      >
        <Space size="middle">
          <BackButton to="/workspace" />
          <Space>
            <RobotOutlined style={{ fontSize: 22, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>
              AI 智能工作台（Person Agent Hub）
            </Title>
          </Space>
        </Space>

        <Space size="middle">
          <Button
            icon={<FilePdfOutlined />}
            disabled={!currentPatient}
            onClick={() => setReportDrawerOpen(true)}
          >
            体检报告解读
          </Button>
          <Button
            icon={<ScheduleOutlined />}
            disabled={!currentPatient}
            onClick={() => setSchemeDrawerOpen(true)}
          >
            健管随访方案
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => {
              refreshToolAudits()
              setAuditDrawerOpen(true)
            }}
          >
            工具审计日志
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
          >
            系统设置
          </Button>
        </Space>
      </Header>

      <Layout style={{ flex: 1, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
        {/* 左侧栏：客户选择与专属摘要板 */}
        <Sider
          width={320}
          theme="light"
          style={{
            borderRight: '1px solid #e8e8e8',
            height: 'calc(100vh - 56px)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '14px 14px 8px', flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <Input
                  prefix={<UserOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />}
                  placeholder="客户姓名"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onPressEnter={handleSearch}
                  allowClear
                  size="small"
                  style={{ borderRadius: 4, flex: 1 }}
                />
                <Input
                  prefix={<PhoneOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />}
                  placeholder="手机号"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onPressEnter={handleSearch}
                  allowClear
                  size="small"
                  style={{ borderRadius: 4, flex: 1.2 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {filteredPatients.length} 位客户
                </Text>
                <Space size={6}>
                  <Button size="small" onClick={handleReset}>
                    重置
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                    loading={loadingPatients}
                  >
                    查询
                  </Button>
                </Space>
              </div>
            </div>

            {/* 客户列表 */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 12px' }}>
              <List
                loading={loadingPatients}
                dataSource={filteredPatients}
                renderItem={(item) => {
                  const isSelected = currentPatient?.id === item.id
                  return (
                    <List.Item
                      key={item.id}
                      onClick={() => setCurrentPatient(item)}
                      style={{
                        padding: '12px',
                        borderRadius: 8,
                        marginBottom: 8,
                        cursor: 'pointer',
                        background: isSelected ? '#e6f7ff' : '#ffffff',
                        border: isSelected ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                        transition: 'all 0.2s',
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{
                              backgroundColor: isSelected ? '#1890ff' : '#87d068',
                            }}
                            icon={<UserOutlined />}
                          />
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ color: isSelected ? '#1890ff' : '#262626' }}>
                              {item.name || '未命名客户'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {item.age ? `${item.age}岁` : ''} {item.gender === 'male' ? '男' : item.gender === 'female' ? '女' : ''}
                            </Text>
                          </div>
                        }
                        description={
                          <div style={{ marginTop: 4 }}>
                            {(item.tags && item.tags.length > 0) ? (
                              <Space size={[0, 4]} wrap>
                                {item.tags.slice(0, 3).map((tag, idx) => (
                                  <Tag key={idx} color="cyan" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
                                    {tag}
                                  </Tag>
                                ))}
                              </Space>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>暂无慢病标签</Text>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            </div>

            {/* 客户专属记忆状态卡片 */}
            {currentPatient && (
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 16px',
                  borderTop: '1px solid #e8e8e8',
                  background: '#fafafa',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <BulbOutlined style={{ color: '#fa8c16' }} />
                  <Text strong style={{ fontSize: 13 }}>
                    客户健康演变摘要 (Rolling Summary)
                  </Text>
                </div>
                <Paragraph
                  style={{
                    fontSize: 12,
                    color: '#595959',
                    margin: 0,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {currentSession?.rolling_summary ||
                    '暂无滚动提炼摘要。随着多轮对话积累，系统将自动异步提取主诉与既往干预结论并在此沉淀。'}
                </Paragraph>
              </div>
            )}
          </div>
        </Sider>

        {/* 中栏：主对话交互区域 */}
        <Content style={{ height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          <AgentChatInterface onOpenSettings={() => setSettingsOpen(true)} />
        </Content>
      </Layout>

      {/* 弹窗与抽屉 */}
      <SystemSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ReportAnalysisDrawer visible={reportDrawerOpen} onClose={() => setReportDrawerOpen(false)} />
      <HealthSchemeGenerator visible={schemeDrawerOpen} onClose={() => setSchemeDrawerOpen(false)} />

      {/* 工具审计日志抽屉 */}
      <Drawer
        title="本地工具调用与人机审核审计日志"
        placement="right"
        width={650}
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={toolAudits}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '触发时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 140,
              render: (t) => <Text style={{ fontSize: 12 }}>{t ? new Date(t).toLocaleString() : '-'}</Text>,
            },
            {
              title: '指令名称',
              dataIndex: 'tool_name',
              key: 'tool_name',
              render: (name) => <Tag color="blue">{name}</Tag>,
            },
            {
              title: '安全等级',
              dataIndex: 'security_level',
              key: 'security_level',
              width: 90,
              render: (lvl) => (
                <Tag color={lvl === 'L3' ? 'error' : lvl === 'L2' ? 'warning' : 'green'}>
                  {lvl}
                </Tag>
              ),
            },
            {
              title: '审核动作',
              dataIndex: 'user_action',
              key: 'user_action',
              width: 100,
              render: (act) => {
                if (act === 'confirmed') return <Badge status="success" text="医生核准" />
                if (act === 'rejected') return <Badge status="error" text="医生取消" />
                return <Badge status="default" text="自动放行" />
              },
            },
            {
              title: '执行结果',
              dataIndex: 'execution_result',
              key: 'execution_result',
              ellipsis: true,
            },
          ]}
        />
      </Drawer>
    </Layout>
  )
}

export default AIAgentWorkspacePage
