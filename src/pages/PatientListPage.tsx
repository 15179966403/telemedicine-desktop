import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Layout,
  Card,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Avatar,
  Typography,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  Radio,
  Badge,
  message,
} from 'antd'
import {
  SearchOutlined,
  UserOutlined,
  ReloadOutlined,
  CalendarOutlined,
  TeamOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  FileTextOutlined,
  BellOutlined,
  FolderOpenOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { BackButton } from '@/components/BackButton'
import { PatientDetailDrawer } from '@/components/PatientDetailDrawer'
import { AppointmentCalendar } from '@/components/AppointmentCalendar'
import { AppointmentModal } from '@/components/AppointmentModal'
import { ReportStorageSettingModal } from '@/components/ReportStorageSettingModal'
import { EditHealthSchemeModal, HealthSchemePreviewModal } from '@/components/HealthScheme'
import { usePatients, useAuth } from '@/hooks'
import { DictService, DictItem, PatientService, ReportFileService } from '@/services'
import type { CustomerRecord, ServiceRecord, HealthSchemeRecord, HealthSchemeQueryParams } from '@/types'
import type { ColumnsType } from 'antd/es/table'
import { downloadFile, buildHealthSchemeFileName } from '@/utils/helpers'
import dayjs from 'dayjs'
import './PatientListPage.css'

const { Header, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

export const PatientListPage: React.FC = () => {
  const { user } = useAuth()
  const {
    activeTab,
    setActiveTab,
    // 客户档案列表
    customers,
    customerTotal,
    customerLoading,
    customerParams,
    fetchCustomers,
    selectedCustomer,
    customerDrawerVisible,
    openCustomerDrawer,
    closeCustomerDrawer,
    // 服务到期提醒
    serviceRecords,
    serviceTotal,
    serviceLoading,
    serviceParams,
    fetchServiceRecords,
    // 预约与随访日历
    appointments,
    appointmentLoading,
    selectedDate,
    setSelectedDate,
    fetchAppointments,
    saveAppointment,
    deleteAppointment,
    appointmentModalVisible,
    editingAppointment,
    openAppointmentModal,
    closeAppointmentModal,
  } = usePatients()

  // 客户列表筛选输入态
  const [customerSearchName, setCustomerSearchName] = useState('')
  const [customerSearchMobile, setCustomerSearchMobile] = useState('')
  const [customerSearchGender, setCustomerSearchGender] = useState<number | undefined>(undefined)

  // 服务记录筛选输入态
  const [serviceSearchUser, setServiceSearchUser] = useState('')
  const [serviceSearchMobile, setServiceSearchMobile] = useState('')
  const [serviceStatusFilter, setServiceStatusFilter] = useState<string>('all')
  const [serviceSearchCodeType, setServiceSearchCodeType] = useState<string | undefined>(undefined)
  const [serviceSearchRecordsType, setServiceSearchRecordsType] = useState<string | undefined>(undefined)

  // 字典数据 (对齐后台 serviceExpirationReminder.vue)
  const [codeTypeOptions, setCodeTypeOptions] = useState<DictItem[]>([])
  const [recordsTypeOptions, setRecordsTypeOptions] = useState<DictItem[]>([])

  // 顶层全局统计看板指标（独立于表格内检索条件和分页，全局持久保持真实值）
  const [globalStats, setGlobalStats] = useState({
    totalCustomers: 0,
    inServiceCount: 0,
    expiringSoonCount: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)

  // 预填快速设置提醒客户
  const [presetCustomerForAppt, setPresetCustomerForAppt] = useState<CustomerRecord | null>(null)

  // 体检报告文件存储路径与清理配置弹窗
  const [storageModalVisible, setStorageModalVisible] = useState(false)

  // 健管方案全局列表状态
  const [globalSchemes, setGlobalSchemes] = useState<HealthSchemeRecord[]>([])
  const [globalSchemeTotal, setGlobalSchemeTotal] = useState(0)
  const [globalSchemeLoading, setGlobalSchemeLoading] = useState(false)
  const [schemePageNum, setSchemePageNum] = useState(1)
  const [schemePageSize, setSchemePageSize] = useState(20)
  const [schemeSearchCustomerName, setSchemeSearchCustomerName] = useState('')
  const [schemeSearchMobile, setSchemeSearchMobile] = useState('')
  const [schemeSearchAuditStatus, setSchemeSearchAuditStatus] = useState<string>('all')
  const [schemeSearchRecordsType, setSchemeSearchRecordsType] = useState<string>('all')

  // 方案弹窗控制
  const [globalSchemePreview, setGlobalSchemePreview] = useState<HealthSchemeRecord | null>(null)
  const [globalSchemeEdit, setGlobalSchemeEdit] = useState<HealthSchemeRecord | null>(null)
  const [globalPreviewVisible, setGlobalPreviewVisible] = useState(false)
  const [globalEditVisible, setGlobalEditVisible] = useState(false)
  const [globalDownloadingSchemeId, setGlobalDownloadingSchemeId] = useState<string | number | null>(null)

  // 拉取健管方案全局列表
  const fetchGlobalSchemes = useCallback(
    async (overrideParams?: HealthSchemeQueryParams) => {
      setGlobalSchemeLoading(true)
      try {
        const params: HealthSchemeQueryParams = {
          pageNum: overrideParams?.pageNum ?? schemePageNum,
          pageSize: overrideParams?.pageSize ?? schemePageSize,
          customerName: overrideParams?.customerName ?? (schemeSearchCustomerName || undefined),
          mobile: overrideParams?.mobile ?? (schemeSearchMobile || undefined),
        }
        const activeStatus = overrideParams?.auditStatus !== undefined
          ? overrideParams.auditStatus
          : schemeSearchAuditStatus
        if (activeStatus && activeStatus !== 'all') {
          params.auditStatus = activeStatus
        }

        const activeRecordsType = overrideParams?.recordsType !== undefined
          ? overrideParams.recordsType
          : schemeSearchRecordsType
        if (activeRecordsType && activeRecordsType !== 'all') {
          params.recordsType = activeRecordsType
        }

        const res = await PatientService.getInstance().fetchHealthSchemeList(params)
        setGlobalSchemes(res.rows || [])
        setGlobalSchemeTotal(res.total || 0)
      } catch (err) {
        console.warn('fetchGlobalSchemes error:', err)
        setGlobalSchemes([])
      } finally {
        setGlobalSchemeLoading(false)
      }
    },
    [
      schemePageNum,
      schemePageSize,
      schemeSearchCustomerName,
      schemeSearchMobile,
      schemeSearchAuditStatus,
      schemeSearchRecordsType,
    ]
  )

  const handleSchemeSearch = () => {
    setSchemePageNum(1)
    fetchGlobalSchemes({ pageNum: 1 })
  }

  const handleSchemeReset = () => {
    setSchemeSearchCustomerName('')
    setSchemeSearchMobile('')
    setSchemeSearchAuditStatus('all')
    setSchemeSearchRecordsType('all')
    setSchemePageNum(1)
    fetchGlobalSchemes({
      pageNum: 1,
      customerName: undefined,
      mobile: undefined,
      auditStatus: undefined,
      recordsType: undefined,
    })
  }

  const handleDownloadGlobalScheme = async (record: HealthSchemeRecord) => {
    const pdfUrl = record.doctorFileUrl || record.fileUrl
    if (!pdfUrl) {
      message.warning('该方案暂无有效 PDF 附件文件')
      return
    }

    try {
      setGlobalDownloadingSchemeId(record.id)
      const custName = record.customerName || record.userName || '客户'
      const custMobile = record.mobile || ''
      const custId = record.customerId || record.id || ''
      const fileName = buildHealthSchemeFileName(record)

      let downloadedLocally = false
      try {
        const res = await ReportFileService.getInstance().downloadSchemeFile({
          customerName: custName,
          mobile: custMobile,
          customerId: custId,
          schemeId: record.id,
          fileUrl: pdfUrl,
          fileName,
        })
        if (res.success) {
          downloadedLocally = true
        }
      } catch (err) {
        console.warn('Tauri 方案本地下载失败，降级浏览器下载:', err)
      }

      if (!downloadedLocally) {
        downloadFile(pdfUrl, fileName)
      }

      if (record.id) {
        await PatientService.getInstance().recordHealthSchemeDownload(record.id)
        setGlobalSchemes(prev =>
          prev.map(item =>
            item.id === record.id
              ? { ...item, doctorDownload: (item.doctorDownload || 0) + 1 }
              : item
          )
        )
      }

      message.success('方案已保存至客户专属文件夹，并记录系统下载计数')
    } catch (err) {
      message.error(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGlobalDownloadingSchemeId(null)
    }
  }

  // 全局方案定位本地目录
  const handleOpenGlobalSchemeFolder = async (record: HealthSchemeRecord) => {
    const custName = record.customerName || record.userName || '客户'
    const custMobile = record.mobile || ''
    const custId = record.customerId || record.id || ''
    const fileName = buildHealthSchemeFileName(record)
    try {
      const st = await ReportFileService.getInstance().checkSchemeStatus({
        customerName: custName,
        mobile: custMobile,
        customerId: custId,
        schemeId: record.id,
        fileName,
      })
      await ReportFileService.getInstance().openLocalFolder(
        st.schemeDir,
        st.exists ? st.localPath : undefined
      )
    } catch (err) {
      message.error('定位方案文件夹失败')
    }
  }

  // 拉取全局看板统计数据（不受表格检索条件过滤与分页影响）
  const fetchGlobalStats = useCallback(async () => {
    setStatsLoading(true)
    const patientService = PatientService.getInstance()
    try {
      const [custRes, inServiceRes, expiringRes] = await Promise.allSettled([
        // 1. 获取管理的客户档案全局总数 (无任何过滤条件)
        patientService.fetchCustomerList({ pageNum: 1, pageSize: 1 }),
        // 2. 获取服务进行中客户全局总数 (status: [3])
        patientService.fetchServiceRecordList({ pageNum: 1, pageSize: 1, status: [3] }),
        // 3. 获取即将到期服务全局总数 (status: [3], isSelect: 1，完全对齐后台数据库统计口径)
        patientService.fetchServiceRecordList({ pageNum: 1, pageSize: 1, status: [3], isSelect: 1 }),
      ])

      let totalCustomers = 0
      if (custRes.status === 'fulfilled' && custRes.value) {
        totalCustomers = custRes.value.total || 0
      }

      let inServiceCount = 0
      if (inServiceRes.status === 'fulfilled' && inServiceRes.value) {
        inServiceCount = inServiceRes.value.total || 0
      }

      let expiringSoonCount = 0
      if (expiringRes.status === 'fulfilled' && expiringRes.value) {
        expiringSoonCount = expiringRes.value.total || 0
      }

      setGlobalStats(prev => ({
        totalCustomers: totalCustomers || prev.totalCustomers,
        inServiceCount: inServiceCount || prev.inServiceCount,
        expiringSoonCount: expiringSoonCount || prev.expiringSoonCount,
      }))
    } catch (err) {
      console.warn('Fetch global overview stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // 初始化加载数据并拉取字典与全局看板指标
  useEffect(() => {
    fetchCustomers({ pageNum: 1, pageSize: 20 })
    fetchServiceRecords({ pageNum: 1, pageSize: 20 })
    fetchAppointments()
    fetchGlobalStats()
    fetchGlobalSchemes({ pageNum: 1, pageSize: 20 })

    // 拉取服务类型与客户标识字典
    const dictService = DictService.getInstance()
    Promise.all([
      dictService.getDicts('service_type'),
      dictService.getDicts('bank_service_label'),
    ])
      .then(([codes, records]) => {
        setCodeTypeOptions(codes)
        setRecordsTypeOptions(records.filter(item => item.dictValue !== '1'))
      })
      .catch(err => {
        console.warn('获取系统字典失败，使用内置默认字典:', err)
      })
  }, [fetchGlobalStats])

  // 今日随访预约日程统计（基于医生整体日程日历）
  const todayApptsCount = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD')
    return appointments.filter(
      a => a.reservationDate === todayStr && a.status !== 2
    ).length
  }, [appointments])

  // 处理刷新当前页面
  const handleRefreshAll = () => {
    fetchGlobalStats()
    if (activeTab === 'customerList') {
      fetchCustomers()
    } else if (activeTab === 'serviceExpiration') {
      fetchServiceRecords()
    } else {
      fetchAppointments()
    }
    message.success('已刷新最新数据')
  }

  // 1. 客户列表查询与重置
  const handleCustomerQuery = () => {
    fetchCustomers({
      pageNum: 1,
      customerName: customerSearchName.trim(),
      mobile: customerSearchMobile.trim(),
      gender: customerSearchGender,
    })
  }

  const handleCustomerReset = () => {
    setCustomerSearchName('')
    setCustomerSearchMobile('')
    setCustomerSearchGender(undefined)
    fetchCustomers({
      pageNum: 1,
      customerName: '',
      mobile: '',
      gender: undefined,
    })
  }

  // 2. 服务记录查询与状态切换 (支持状态、姓名、手机号、服务类型字典、客户标识字典联合检索)
  const handleServiceStatusChange = (statusKey: string) => {
    setServiceStatusFilter(statusKey)
    let statusVal: number[] | undefined = undefined
    let isSelectVal: number | undefined = undefined

    if (statusKey === 'in_service') {
      statusVal = [3]
    } else if (statusKey === 'expiring_soon') {
      statusVal = [3]
      isSelectVal = 1
    } else if (statusKey === 'wait_service') {
      statusVal = [2]
    } else if (statusKey === 'ended') {
      statusVal = [4]
    }

    fetchServiceRecords({
      pageNum: 1,
      status: statusVal,
      isSelect: isSelectVal,
      remainingDays: undefined,
      userName: serviceSearchUser.trim(),
      mobile: serviceSearchMobile.trim(),
      codeType: serviceSearchCodeType,
      recordsType: serviceSearchRecordsType,
    })
  }

  const handleServiceQuery = () => {
    let statusVal: number[] | undefined = undefined
    let isSelectVal: number | undefined = undefined

    if (serviceStatusFilter === 'in_service') {
      statusVal = [3]
    } else if (serviceStatusFilter === 'expiring_soon') {
      statusVal = [3]
      isSelectVal = 1
    } else if (serviceStatusFilter === 'wait_service') {
      statusVal = [2]
    } else if (serviceStatusFilter === 'ended') {
      statusVal = [4]
    }

    fetchServiceRecords({
      pageNum: 1,
      status: statusVal,
      isSelect: isSelectVal,
      remainingDays: undefined,
      userName: serviceSearchUser.trim(),
      mobile: serviceSearchMobile.trim(),
      codeType: serviceSearchCodeType,
      recordsType: serviceSearchRecordsType,
    })
  }

  const handleServiceReset = () => {
    setServiceSearchUser('')
    setServiceSearchMobile('')
    setServiceSearchCodeType(undefined)
    setServiceSearchRecordsType(undefined)
    setServiceStatusFilter('all')
    fetchServiceRecords({
      pageNum: 1,
      status: undefined,
      isSelect: undefined,
      remainingDays: undefined,
      userName: '',
      mobile: '',
      codeType: undefined,
      recordsType: undefined,
    })
  }

  // 打开快速设置随访提醒弹窗
  const handleOpenQuickReminder = (record: CustomerRecord) => {
    setPresetCustomerForAppt(record)
    openAppointmentModal(null)
  }

  // 快捷从未预约列表打开档案
  const handleViewCustomerByMobile = (mobile: string, userName: string) => {
    const existing = customers.find(c => c.mobile === mobile)
    if (existing) {
      openCustomerDrawer(existing)
    } else {
      openCustomerDrawer({
        id: `mock_${mobile}`,
        customerName: userName,
        mobile,
      })
    }
  }

  // 客户列表表格列定义（根据要求去除身份证号、指标标识、慢病/大病标识、所属单位）
  const customerColumns: ColumnsType<CustomerRecord> = [
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 130,
      render: (text, record) => (
        <span
          className="customer-name-link"
          onClick={() => openCustomerDrawer(record)}
        >
          {text || '未知客户'}
        </span>
      ),
    },
    {
      title: '性别/年龄',
      key: 'genderAge',
      width: 110,
      render: (_, record) => {
        const gender =
          record.gender === 1 || record.gender === '1'
            ? '男'
            : record.gender === 2 || record.gender === '2'
              ? '女'
              : '-'
        return <span>{gender} / {record.age ? `${record.age}岁` : '-'}</span>
      },
    },
    {
      title: '手机号码',
      dataIndex: 'mobile',
      key: 'mobile',
      width: 140,
    },
    {
      title: '专属多学科团队',
      key: 'team',
      width: 180,
      render: (_, record) => (
        <div style={{ fontSize: 13 }}>
          <div>医师: {record.ownerPhysicianName || '-'}</div>
          <div style={{ color: '#888' }}>健管: {record.ownerCsName || '-'}</div>
        </div>
      ),
    },
    {
      title: '建档时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 160,
      render: text => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => openCustomerDrawer(record)}
          >
            查看档案
          </Button>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<BellOutlined />}
            onClick={() => handleOpenQuickReminder(record)}
          >
            快速设置提醒
          </Button>
        </Space>
      ),
    },
  ]

  // 服务记录与到期提醒表格列定义 (参考 serviceExpirationReminder.vue)
  const serviceColumns: ColumnsType<ServiceRecord> = [
    {
      title: '客户名称',
      dataIndex: 'userName',
      key: 'userName',
      width: 110,
      render: (text, record) => (
        <span
          className="customer-name-link"
          onClick={() => {
            const matchedCustomer = customers.find(c => c.mobile === record.mobile)
            openCustomerDrawer(
              matchedCustomer || {
                id: record.customerId || record.id,
                customerId: record.customerId,
                customerName: record.userName,
                mobile: record.mobile,
                gender: record.gender,
                age: record.age,
                topCompanyName: record.topCompanyName,
                subCompanyName: record.subCompanyName,
                ownerPhysicianName: record.ownerPhysicianName,
              }
            )
          }}
        >
          {text || '未知客户'}
        </span>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'mobile',
      key: 'mobile',
      width: 125,
      render: text => <span style={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}>{text || '-'}</span>,
    },
    {
      title: '客户标识',
      key: 'customerTag',
      width: 95,
      render: (_, record) => {
        const info = DictService.getInstance().getCustomerLabel(record, recordsTypeOptions)
        return (
          <Tag
            bordered={false}
            color={info.color}
            style={{ margin: 0, fontSize: 12, padding: '1px 8px', borderRadius: 4 }}
          >
            {info.text}
          </Tag>
        )
      },
    },
    {
      title: '服务状态',
      dataIndex: 'status',
      key: 'status',
      width: 95,
      render: status => {
        if (status === 2) return <Badge status="warning" text="待服务" />
        if (status === 3) return <Badge status="success" text="服务中" />
        if (status === 4) return <Badge status="default" text="服务结束" />
        return <Badge status="default" text="未知" />
      },
    },
    {
      title: '剩余天数',
      dataIndex: 'remainingDays',
      key: 'remainingDays',
      width: 145,
      render: (days, record) => {
        const num = Number(days)
        if (record.status === 4) return <Text type="secondary">已完结</Text>
        if (isNaN(num)) return <span>{days || '-'}</span>
        if (num <= 10 && num >= 0) {
          return <span className="days-badge-urgent">{num} 天 (即将到期)</span>
        }
        if (num <= 30 && num >= 0) {
          return <span className="days-badge-warning">{num} 天</span>
        }
        return <span className="days-badge-normal">{num} 天</span>
      },
    },
    {
      title: '服务类型',
      key: 'codeType',
      width: 200,
      render: (_, record) => {
        // 从 service_type 字典解析真实服务类型名称，杜绝使用硬编码默认值
        const typeLabel = DictService.getInstance().getCodeTypeLabel(record.codeType, codeTypeOptions)
        return (
          <div style={{ lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600, color: '#1f1f1f', fontSize: 13 }}>{typeLabel}</div>
            {record.itemCodeName && (
              <div style={{ color: '#1677ff', fontSize: 11 }}>项目: {record.itemCodeName}</div>
            )}
            {record.recordsNumber && (
              <div style={{ color: '#8c8c8c', fontSize: 11, fontFamily: 'monospace' }}>
                单号: {record.recordsNumber}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: '服务周期',
      key: 'servicePeriod',
      width: 195,
      render: (_, record) => {
        const formatSimpleDate = (val?: string) => {
          if (!val) return '-'
          return val.includes(' ') ? val.split(' ')[0] : val
        }
        const start = formatSimpleDate(record.serviceStartTime)
        const end = formatSimpleDate(record.serviceEndTime)
        return (
          <div style={{ fontSize: 12, color: '#595959', whiteSpace: 'nowrap' }}>
            <span>{start}</span>
            <span style={{ margin: '0 4px', color: '#bfbfbf' }}>至</span>
            <span>{end}</span>
          </div>
        )
      },
    },
    {
      title: '专属服务团队',
      key: 'team',
      width: 135,
      render: (_, record) => (
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
          <div>医师: {record.ownerPhysicianName || '-'}</div>
          <div style={{ color: '#8c8c8c' }}>健管: {record.ownerHealthName || '-'}</div>
        </div>
      ),
    },
    {
      title: '建联 / 方案',
      key: 'connectScheme',
      width: 125,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag
            bordered={false}
            color={record.joinGroupFlag === 1 ? 'blue' : 'default'}
            style={{ margin: 0, fontSize: 11, borderRadius: 4 }}
          >
            {record.joinGroupFlag === 1 ? '企微已建联' : '未建联'}
          </Tag>
          <Tag
            bordered={false}
            color={record.generateStatus === 1 || record.generateStatus === 2 ? 'green' : 'orange'}
            style={{ margin: 0, fontSize: 11, borderRadius: 4 }}
          >
            {record.generateStatus === 1 || record.generateStatus === 2 ? '方案已生成' : '方案未生成'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => {
              const matchedCustomer = customers.find(c => c.mobile === record.mobile)
              openCustomerDrawer(
                matchedCustomer || {
                  id: record.customerId || record.id,
                  customerId: record.customerId,
                  customerName: record.userName,
                  mobile: record.mobile,
                  gender: record.gender,
                  age: record.age,
                  topCompanyName: record.topCompanyName,
                  subCompanyName: record.subCompanyName,
                  ownerPhysicianName: record.ownerPhysicianName,
                }
              )
            }}
          >
            档案
          </Button>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<BellOutlined />}
            onClick={() =>
              handleOpenQuickReminder({
                id: record.id,
                customerId: record.customerId,
                customerName: record.userName,
                mobile: record.mobile,
              })
            }
          >
            快速设置提醒
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="patient-manage-page">
      {/* 顶部导航与工作栏 */}
      <Header className="patient-header">
        <Space size="middle">
          <BackButton />
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            患者与服务管理中心
          </Title>
        </Space>

        <Space size="middle">
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <Text strong>{user?.name || '医生'}</Text>
            {user?.department && <Tag color="blue">{user.department}</Tag>}
          </Space>
          <Button icon={<FolderOpenOutlined />} onClick={() => setStorageModalVisible(true)}>
            文件存储与清理
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefreshAll}>
            刷新数据
          </Button>
        </Space>
      </Header>

      <Content className="patient-content">
        {/* 顶部综合看板卡片（显示医生管辖维度的全局真实统计，不被分页或检索条件过滤） */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card className="stat-card" size="small">
              <Statistic
                title="管理的客户档案总数"
                value={globalStats.totalCustomers || customerTotal}
                loading={statsLoading}
                prefix={<TeamOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
                valueStyle={{ color: '#1890ff', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card" size="small">
              <Statistic
                title="服务进行中客户"
                value={globalStats.inServiceCount}
                loading={statsLoading}
                prefix={<HeartOutlined style={{ color: '#52c41a', marginRight: 8 }} />}
                valueStyle={{ color: '#52c41a', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card" size="small">
              <Statistic
                title="30天内到期服务"
                value={globalStats.expiringSoonCount}
                loading={statsLoading}
                prefix={<ClockCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />}
                valueStyle={{ color: globalStats.expiringSoonCount > 0 ? '#fa8c16' : '#999', fontWeight: 600 }}
                suffix={
                  globalStats.expiringSoonCount > 0 ? (
                    <Tag color="warning" className="stat-tag-warning">
                      需续期沟通
                    </Tag>
                  ) : null
                }
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card" size="small">
              <Statistic
                title="今日预约随访日程"
                value={todayApptsCount}
                prefix={<CalendarOutlined style={{ color: '#722ed1', marginRight: 8 }} />}
                valueStyle={{ color: '#722ed1', fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 主视图区域：多标签切换 */}
        <Card className="main-tabs-card" bordered={false}>
          <Tabs
            activeKey={activeTab}
            onChange={key => setActiveTab(key as any)}
            size="large"
            items={[
              {
                key: 'customerList',
                label: (
                  <span>
                    <TeamOutlined />
                    客户档案列表 ({globalStats.totalCustomers || customerTotal})
                  </span>
                ),
                children: (
                  <div>
                    {/* 客户搜索栏 */}
                    <div className="search-toolbar">
                      <Row gutter={[16, 12]} align="middle">
                        <Col xs={24} sm={8} md={6}>
                          <Input
                            placeholder="搜索客户姓名"
                            value={customerSearchName}
                            onChange={e => setCustomerSearchName(e.target.value)}
                            onPressEnter={handleCustomerQuery}
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={24} sm={8} md={6}>
                          <Input
                            placeholder="搜索手机号码"
                            value={customerSearchMobile}
                            onChange={e => setCustomerSearchMobile(e.target.value)}
                            onPressEnter={handleCustomerQuery}
                            prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={12} sm={8} md={4}>
                          <Select
                            placeholder="选择性别"
                            style={{ width: '100%' }}
                            value={customerSearchGender}
                            onChange={val => setCustomerSearchGender(val)}
                            allowClear
                          >
                            <Option value={1}>男</Option>
                            <Option value={2}>女</Option>
                          </Select>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Space>
                            <Button type="primary" icon={<SearchOutlined />} onClick={handleCustomerQuery}>
                              查询
                            </Button>
                            <Button onClick={handleCustomerReset}>重置</Button>
                          </Space>
                        </Col>
                      </Row>
                    </div>

                    {/* 客户主表格（已去除身份证号、指标标识、慢病/大病标识、所属单位） */}
                    <Table
                      size="middle"
                      columns={customerColumns}
                      dataSource={customers}
                      rowKey={record => String(record.id ?? record.customerId ?? record.mobile)}
                      loading={customerLoading}
                      scroll={{ x: 1050 }}
                      pagination={{
                        current: customerParams.pageNum || 1,
                        pageSize: customerParams.pageSize || 20,
                        total: customerTotal,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showQuickJumper: true,
                        showTotal: total => `共 ${total} 位客户`,
                        onChange: (page, pageSize) => {
                          fetchCustomers({ pageNum: page, pageSize })
                        },
                      }}
                    />
                  </div>
                ),
              },
              {
                key: 'serviceExpiration',
                label: (
                  <span>
                    <ClockCircleOutlined />
                    服务记录与到期提醒
                  </span>
                ),
                children: (
                  <div>
                    {/* 服务记录快捷状态过滤器与搜索 (包含字典服务类型与客户标识) */}
                    <div className="search-toolbar">
                      <div style={{ marginBottom: 12 }}>
                        <Radio.Group
                          value={serviceStatusFilter}
                          onChange={e => handleServiceStatusChange(e.target.value)}
                          buttonStyle="solid"
                        >
                          <Radio.Button value="all">全部记录</Radio.Button>
                          <Radio.Button value="in_service">服务中</Radio.Button>
                          <Radio.Button value="expiring_soon">
                            即将到期 (≤30天)
                            {globalStats.expiringSoonCount > 0 && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  padding: '1px 6px',
                                  fontSize: 11,
                                  borderRadius: 10,
                                  backgroundColor: '#ff4d4f',
                                  color: '#fff',
                                  fontWeight: 600,
                                }}
                              >
                                {globalStats.expiringSoonCount}
                              </span>
                            )}
                          </Radio.Button>
                          <Radio.Button value="wait_service">待服务</Radio.Button>
                          <Radio.Button value="ended">服务结束</Radio.Button>
                        </Radio.Group>
                      </div>

                      <Row gutter={[12, 12]} align="middle">
                        <Col xs={24} sm={12} md={5}>
                          <Input
                            placeholder="搜索客户姓名"
                            value={serviceSearchUser}
                            onChange={e => setServiceSearchUser(e.target.value)}
                            onPressEnter={handleServiceQuery}
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={24} sm={12} md={5}>
                          <Input
                            placeholder="搜索客户手机号"
                            value={serviceSearchMobile}
                            onChange={e => setServiceSearchMobile(e.target.value)}
                            onPressEnter={handleServiceQuery}
                            prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={12} sm={8} md={4}>
                          <Select
                            placeholder="服务类型"
                            style={{ width: '100%' }}
                            value={serviceSearchCodeType}
                            onChange={val => setServiceSearchCodeType(val)}
                            allowClear
                          >
                            {codeTypeOptions.map(item => (
                              <Option key={item.dictValue} value={item.dictValue}>
                                {item.dictLabel}
                              </Option>
                            ))}
                          </Select>
                        </Col>
                        <Col xs={12} sm={8} md={4}>
                          <Select
                            placeholder="客户标识"
                            style={{ width: '100%' }}
                            value={serviceSearchRecordsType}
                            onChange={val => setServiceSearchRecordsType(val)}
                            allowClear
                          >
                            {recordsTypeOptions.map(item => (
                              <Option key={item.dictValue} value={item.dictValue}>
                                {item.dictLabel}
                              </Option>
                            ))}
                          </Select>
                        </Col>
                        <Col xs={24} sm={8} md={6}>
                          <Space>
                            <Button type="primary" icon={<SearchOutlined />} onClick={handleServiceQuery}>
                              查询
                            </Button>
                            <Button onClick={handleServiceReset}>重置</Button>
                          </Space>
                        </Col>
                      </Row>
                    </div>

                    {/* 服务记录表格 */}
                    <Table
                      size="middle"
                      columns={serviceColumns}
                      dataSource={serviceRecords}
                      rowKey={record => String(record.id ?? record.recordsNumber ?? record.mobile)}
                      loading={serviceLoading}
                      scroll={{ x: 1400 }}
                      pagination={{
                        current: serviceParams.pageNum || 1,
                        pageSize: serviceParams.pageSize || 20,
                        total: serviceTotal,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showQuickJumper: true,
                        showTotal: total => `共 ${total} 条服务记录`,
                        onChange: (page, pageSize) => {
                          fetchServiceRecords({ pageNum: page, pageSize })
                        },
                      }}
                    />
                  </div>
                ),
              },
              {
                key: 'calendar',
                label: (
                  <span>
                    <CalendarOutlined />
                    随访与预约日历 (工作便签)
                  </span>
                ),
                children: (
                  <AppointmentCalendar
                    appointments={appointments}
                    selectedDate={selectedDate}
                    loading={appointmentLoading}
                    onSelectDate={date => {
                      setSelectedDate(date)
                      fetchAppointments({ reservationDate: date })
                    }}
                    onAddAppointment={() => {
                      setPresetCustomerForAppt(null)
                      openAppointmentModal(null)
                    }}
                    onEditAppointment={record => {
                      openAppointmentModal(record)
                    }}
                    onDeleteAppointment={id => {
                      deleteAppointment(id).then(() => {
                        message.success('已删除随访预约记录')
                      })
                    }}
                    onStatusChange={(record, newStatus) => {
                      saveAppointment({ ...record, status: newStatus }).then(() => {
                        message.success('已标记完成')
                      })
                    }}
                    onRefresh={() => fetchAppointments()}
                    onViewCustomerDetail={handleViewCustomerByMobile}
                  />
                ),
              },
              {
                key: 'schemes',
                label: (
                  <span>
                    <SolutionOutlined />
                    健管方案管理 ({globalSchemeTotal})
                  </span>
                ),
                children: (
                  <div>
                    {/* 方案搜索栏 */}
                    <div className="search-toolbar">
                      <Row gutter={[16, 12]} align="middle">
                        <Col xs={24} sm={8} md={6}>
                          <Input
                            placeholder="搜索客户姓名"
                            value={schemeSearchCustomerName}
                            onChange={e => setSchemeSearchCustomerName(e.target.value)}
                            onPressEnter={handleSchemeSearch}
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={24} sm={8} md={6}>
                          <Input
                            placeholder="搜索联系方式"
                            value={schemeSearchMobile}
                            onChange={e => setSchemeSearchMobile(e.target.value)}
                            onPressEnter={handleSchemeSearch}
                            prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
                            allowClear
                          />
                        </Col>
                        <Col xs={12} sm={8} md={4}>
                          <Select
                            placeholder="审核状态"
                            style={{ width: '100%' }}
                            value={schemeSearchAuditStatus}
                            onChange={val => {
                              setSchemeSearchAuditStatus(val)
                              fetchGlobalSchemes({ auditStatus: val, pageNum: 1 })
                            }}
                            options={[
                              { label: '全部状态', value: 'all' },
                              { label: '待审核', value: '0' },
                              { label: '营养师通过', value: '1' },
                              { label: '营养师驳回', value: '2' },
                              { label: '医师通过', value: '3' },
                              { label: '医师驳回', value: '4' },
                              { label: '数据不全', value: '5' },
                            ]}
                          />
                        </Col>
                        <Col xs={12} sm={8} md={4}>
                          <Select
                            placeholder="客户标识"
                            style={{ width: '100%' }}
                            value={schemeSearchRecordsType}
                            onChange={val => {
                              setSchemeSearchRecordsType(val)
                              fetchGlobalSchemes({ recordsType: val, pageNum: 1 })
                            }}
                            options={[
                              { label: '全部标识', value: 'all' },
                              { label: '三好卡', value: '0' },
                              { label: '安颐健康', value: '6' },
                            ]}
                          />
                        </Col>
                        <Col xs={24} sm={8} md={4}>
                          <Space>
                            <Button type="primary" icon={<SearchOutlined />} onClick={handleSchemeSearch}>
                              查询
                            </Button>
                            <Button onClick={handleSchemeReset}>重置</Button>
                          </Space>
                        </Col>
                      </Row>
                    </div>

                    {/* 健管方案列表表格 */}
                    <Table
                      dataSource={globalSchemes}
                      rowKey={record => String(record.id)}
                      loading={globalSchemeLoading}
                      pagination={{
                        current: schemePageNum,
                        pageSize: schemePageSize,
                        total: globalSchemeTotal,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                        showTotal: total => `共 ${total} 份方案`,
                        onChange: (page, size) => {
                          setSchemePageNum(page)
                          setSchemePageSize(size)
                          fetchGlobalSchemes({ pageNum: page, pageSize: size })
                        },
                      }}
                      size="middle"
                      className="customers-table"
                      columns={[
                        {
                          title: '客户标识',
                          dataIndex: 'recordsType',
                          key: 'recordsType',
                          width: 95,
                          align: 'center',
                          render: (type: number) => (
                            <Tag color={type === 6 ? 'volcano' : 'blue'}>
                              {type === 6 ? '安颐健康' : '三好卡'}
                            </Tag>
                          ),
                        },
                        {
                          title: '用户姓名',
                          dataIndex: 'customerName',
                          key: 'customerName',
                          width: 120,
                          render: (name: string, record: HealthSchemeRecord) => (
                            <span style={{ fontWeight: 500 }}>
                              {name || record.userName || '-'}
                            </span>
                          ),
                        },
                        {
                          title: '联系方式',
                          dataIndex: 'mobile',
                          key: 'mobile',
                          width: 130,
                          render: (mobile: string) => mobile || '-',
                        },
                        {
                          title: '服务类型',
                          dataIndex: 'codeType',
                          key: 'codeType',
                          width: 130,
                          render: (codeType: any) => {
                            const matched = codeTypeOptions.find(item => String(item.dictValue) === String(codeType))
                            return matched ? matched.dictLabel : (codeType ?? '-')
                          },
                        },
                        {
                          title: '激活时间',
                          dataIndex: 'activationTime',
                          key: 'activationTime',
                          width: 160,
                          render: (time: string) => time || '-',
                        },
                        {
                          title: '审核状态',
                          dataIndex: 'auditStatus',
                          key: 'auditStatus',
                          width: 110,
                          align: 'center',
                          render: (status: number) => {
                            switch (status) {
                              case 0:
                                return <Tag color="default">待审核</Tag>
                              case 1:
                                return <Tag color="cyan">营养师通过</Tag>
                              case 2:
                                return <Tag color="error">营养师驳回</Tag>
                              case 3:
                                return <Tag color="success">医师通过</Tag>
                              case 4:
                                return <Tag color="error">医师驳回</Tag>
                              case 5:
                                return <Tag color="warning">数据不全</Tag>
                              default:
                                return <Tag>方案已生成</Tag>
                            }
                          },
                        },
                        {
                          title: '审核医师',
                          dataIndex: 'doctorName',
                          key: 'doctorName',
                          width: 100,
                          render: (name: string, record: HealthSchemeRecord) =>
                            name || record.ownerPhysicianName || '-',
                        },
                        {
                          title: '下载次数',
                          dataIndex: 'doctorDownload',
                          key: 'doctorDownload',
                          width: 90,
                          align: 'center',
                          render: (count: number) => (
                            <Badge
                              count={count || 0}
                              overflowCount={999}
                              style={{
                                backgroundColor: (count || 0) > 0 ? '#52c41a' : '#bfbfbf',
                              }}
                            />
                          ),
                        },
                        {
                          title: '医师审核时间',
                          dataIndex: 'doctorAuditTime',
                          key: 'doctorAuditTime',
                          width: 160,
                          render: (time: string) => time || '-',
                        },
                        {
                          title: '创建时间',
                          dataIndex: 'createTime',
                          key: 'createTime',
                          width: 160,
                          render: (time: string) => time || '-',
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 220,
                          fixed: 'right',
                          align: 'center',
                          render: (_: any, record: HealthSchemeRecord) => {
                            const isDownloading = globalDownloadingSchemeId === record.id
                            const isRegenerating = record.async === 1

                            return (
                              <Space size="middle">
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  onClick={() => {
                                    const name = record.customerName || record.userName || '未知客户'
                                    const phone = record.mobile || ''
                                    if (record.mobile) {
                                      handleViewCustomerByMobile(record.mobile, name)
                                    } else {
                                      openCustomerDrawer({
                                        id: record.customerId || record.id,
                                        customerId: record.customerId,
                                        customerName: name,
                                        mobile: phone,
                                        ownerPhysicianName: record.ownerPhysicianName || record.doctorName,
                                      })
                                    }
                                  }}
                                >
                                  档案
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  onClick={() => {
                                    setGlobalSchemePreview(record)
                                    setGlobalPreviewVisible(true)
                                  }}
                                >
                                  预览
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  disabled={isRegenerating}
                                  onClick={() => {
                                    setGlobalSchemeEdit(record)
                                    setGlobalEditVisible(true)
                                  }}
                                >
                                  快速修改
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  loading={isDownloading}
                                  onClick={() => handleDownloadGlobalScheme(record)}
                                >
                                  下载发客户
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  onClick={() => handleOpenGlobalSchemeFolder(record)}
                                >
                                  定位
                                </Button>
                              </Space>
                            )
                          },
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Content>

      {/* 健管方案预览弹窗 */}
      <HealthSchemePreviewModal
        visible={globalPreviewVisible}
        schemeRecord={globalSchemePreview}
        customer={
          globalSchemePreview
            ? {
                customerName: globalSchemePreview.customerName || globalSchemePreview.userName,
                mobile: globalSchemePreview.mobile,
                id: globalSchemePreview.customerId || globalSchemePreview.id,
              }
            : null
        }
        onClose={() => {
          setGlobalPreviewVisible(false)
          setGlobalSchemePreview(null)
        }}
        onEdit={record => {
          setGlobalPreviewVisible(false)
          setGlobalSchemeEdit(record)
          setGlobalEditVisible(true)
        }}
        onDownloadSuccess={schemeId => {
          setGlobalSchemes(prev =>
            prev.map(item =>
              item.id === schemeId
                ? { ...item, doctorDownload: (item.doctorDownload || 0) + 1 }
                : item
            )
          )
        }}
      />

      {/* 健管方案快速修改与重生成弹窗 */}
      <EditHealthSchemeModal
        visible={globalEditVisible}
        schemeRecord={globalSchemeEdit}
        onClose={() => {
          setGlobalEditVisible(false)
          setGlobalSchemeEdit(null)
        }}
        onSuccess={() => {
          fetchGlobalSchemes()
        }}
      />

      {/* 客户完整档案详情抽屉 */}
      <PatientDetailDrawer
        customer={selectedCustomer}
        visible={customerDrawerVisible}
        onClose={closeCustomerDrawer}
        onScheduleAppointment={customer => {
          handleOpenQuickReminder(customer)
        }}
      />

      {/* 快速设置随访提醒弹窗 */}
      <AppointmentModal
        visible={appointmentModalVisible}
        initialData={editingAppointment}
        presetCustomer={presetCustomerForAppt}
        defaultDate={selectedDate}
        onClose={() => {
          closeAppointmentModal()
          setPresetCustomerForAppt(null)
        }}
        onSave={async payload => {
          await saveAppointment(payload)
        }}
      />

      {/* 体检报告文件存储路径与清理配置弹窗 */}
      <ReportStorageSettingModal
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
      />
    </div>
  )
}

export default PatientListPage
