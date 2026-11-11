import React, { useState, useEffect, useMemo } from 'react'
import {
  Drawer,
  Descriptions,
  Avatar,
  Tag,
  Space,
  Button,
  Tabs,
  Card,
  Typography,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  Input,
  Table,
  Modal,
  Image,
  Tooltip,
  Select,
  Badge,
  message,
} from 'antd'
import {
  UserOutlined,
  PhoneOutlined,
  IdcardOutlined,
  CalendarOutlined,
  TeamOutlined,
  SaveOutlined,
  BellOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  FileSearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  FolderViewOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ProfileOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import type { CustomerRecord, Patient, MedicalReport, QuestionnaireRecord, HealthSchemeRecord } from '@/types'
import { PatientService } from '@/services/patientService'
import { ReportFileService, ReportStatusResult, DictService, type DictItem } from '@/services'
import { ReportStorageSettingModal } from '@/components/ReportStorageSettingModal'
import { UploadMedicalReportModal } from '@/components/UploadMedicalReportModal'
import { QuestionnaireDetailModal } from '@/components/QuestionnaireDetailModal'
import { EditHealthSchemeModal, HealthSchemePreviewModal } from '@/components/HealthScheme'
import { resolveCustomerDisplayName } from '@/components/AppointmentModal/AppointmentModal'
import { downloadFile } from '@/utils/helpers'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface PatientDetailDrawerProps {
  patient?: Patient | null
  customer?: CustomerRecord | null
  visible: boolean
  onClose: () => void
  onScheduleAppointment?: (customer: CustomerRecord) => void
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patient,
  customer,
  visible,
  onClose,
  onScheduleAppointment,
}) => {
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState<CustomerRecord | null>(null)
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [selectedReportForEval, setSelectedReportForEval] = useState<MedicalReport | null>(null)
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [activeReportForPreview, setActiveReportForPreview] = useState<MedicalReport | null>(null)
  const [reportStatusMap, setReportStatusMap] = useState<Record<string, ReportStatusResult>>({})
  const [downloadingReportId, setDownloadingReportId] = useState<string | number | null>(null)
  const [storageModalVisible, setStorageModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [singleFileLoading, setSingleFileLoading] = useState<Record<string, boolean>>({})
  const [doctorMemo, setDoctorMemo] = useState<string>('')
  const [memoSaving, setMemoSaving] = useState(false)

  // 健康生活问卷状态
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireRecord[]>([])
  const [questionnairesLoading, setQuestionnairesLoading] = useState(false)
  const [questionnaireStatusFilter, setQuestionnaireStatusFilter] = useState<string>('all')
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | number | null>(null)
  const [questionnaireModalVisible, setQuestionnaireModalVisible] = useState(false)
  const [exportingQuestionnaireId, setExportingQuestionnaireId] = useState<string | number | null>(null)

  // 健管方案状态
  const [schemes, setSchemes] = useState<HealthSchemeRecord[]>([])
  const [schemesLoading, setSchemesLoading] = useState(false)
  const [selectedSchemeForPreview, setSelectedSchemeForPreview] = useState<HealthSchemeRecord | null>(null)
  const [selectedSchemeForEdit, setSelectedSchemeForEdit] = useState<HealthSchemeRecord | null>(null)
  const [schemePreviewVisible, setSchemePreviewVisible] = useState(false)
  const [schemeEditVisible, setSchemeEditVisible] = useState(false)
  const [downloadingSchemeId, setDownloadingSchemeId] = useState<string | number | null>(null)
  const [schemeServiceDict, setSchemeServiceDict] = useState<DictItem[]>([])

  // 加载服务类型字典
  useEffect(() => {
    DictService.getInstance()
      .getDicts('service_type')
      .then(res => {
        setSchemeServiceDict(res || [])
      })
      .catch(err => {
        console.warn('Load service_type dict failed:', err)
      })
  }, [])

  const getSchemeServiceTypeName = (val?: string | number) => {
    if (val === undefined || val === null) return '-'
    const matched = schemeServiceDict.find(item => String(item.dictValue) === String(val))
    return matched ? matched.dictLabel : String(val)
  }

  // 融合客户数据源
  const activeCustomer: CustomerRecord | null =
    customer ||
    (patient
      ? {
          id: patient.id,
          customerId: patient.customerId,
          customerName: patient.name,
          mobile: patient.phone,
          gender: patient.gender === 'male' ? 1 : 2,
          age: patient.age,
          idCardNo: patient.idCard,
          vipName: patient.vipName,
          topCompanyName: patient.companyName,
          subCompanyName: patient.subCompanyName,
          ownerPhysicianName: patient.ownerPhysicianName,
          ownerCsName: patient.ownerCsName,
          abTag: patient.tags?.join(','),
        }
      : null)

  const reportFileService = ReportFileService.getInstance()

  // 批量检查体检报告本地存储与更新状态
  const checkReportsStatus = async (reportList: MedicalReport[], cust: CustomerRecord) => {
    if (!reportList || reportList.length === 0) return
    const newMap: Record<string, ReportStatusResult> = {}
    await Promise.allSettled(
      reportList.map(async r => {
        const rawId = r.reportId ?? r.id
        if (!rawId) return
        const key = String(rawId)
        try {
          const st = await reportFileService.checkReportStatus({
            customerId: cust.id ?? cust.customerId ?? '',
            customerName: cust.customerName || '未命名',
            mobile: cust.mobile || '',
            reportId: rawId,
            reportDate: r.reportTime || r.uploadTime || r.createTime,
            medicalOrg: r.medicalOrg,
            fileUrls: Array.isArray(r.fileUrls) ? r.fileUrls : [],
            remoteUpdateTime: r.updateTime || r.uploadTime || r.createTime,
          })
          newMap[key] = st
        } catch (e) {
          console.warn('Check report file status failed for reportId:', rawId, e)
        }
      })
    )
    setReportStatusMap(prev => ({ ...prev, ...newMap }))
  }

  // 当抽屉打开时加载档案详情及体检报告列表（对接后台 /admin/peCustomer/reportPageList）
  useEffect(() => {
    if (visible && activeCustomer) {
      setLoading(true)
      const patientService = PatientService.getInstance()

      // 读取本地持久化的医生备注
      const memoKey = `doctor_memo_cust_${activeCustomer.id}`
      const savedMemo = localStorage.getItem(memoKey) || ''
      setDoctorMemo(savedMemo)

      // 先拉取客户主档案，确保获取真实的“系统档案编号”(customer.id)
      patientService
        .fetchCustomerProfile({
          id: activeCustomer.id,
          customerId: activeCustomer.customerId,
          mobile: activeCustomer.mobile,
        })
        .then(async profileRes => {
          const loadedCust = profileRes.customer || activeCustomer
          setProfileData(loadedCust)

          // 并行加载客户健康生活问卷与健管方案
          fetchCustomerQuestionnairesData(loadedCust)
          fetchCustomerHealthSchemesData(loadedCust)

          // 核心修正：/admin/peCustomer/reportPageList 接口的请求参数 customerId
          // 必须使用“健康档案详情”板块中的“系统档案编号”（即 loadedCust.id 原始格式）
          const systemArchiveId = loadedCust.id ?? activeCustomer.id
          if (systemArchiveId != null && systemArchiveId !== '') {
            setReportsLoading(true)
            try {
              const reportList = await patientService.fetchCustomerReports(systemArchiveId)
              setReports(reportList || [])
              if (reportList && reportList.length > 0) {
                checkReportsStatus(reportList, loadedCust)
              }
            } catch (err) {
              console.warn('Load customer reports failed:', err)
              setReports([])
            } finally {
              setReportsLoading(false)
            }
          } else {
            setReports([])
          }
        })
        .catch(async err => {
          console.warn('Load customer profile failed, using local activeCustomer:', err)
          setProfileData(activeCustomer)
          fetchCustomerQuestionnairesData(activeCustomer)
          fetchCustomerHealthSchemesData(activeCustomer)
          const fallbackArchiveId = activeCustomer.id
          if (fallbackArchiveId != null && fallbackArchiveId !== '') {
            setReportsLoading(true)
            try {
              const reportList = await patientService.fetchCustomerReports(fallbackArchiveId)
              setReports(reportList || [])
              if (reportList && reportList.length > 0) {
                checkReportsStatus(reportList, activeCustomer)
              }
            } catch {
              setReports([])
            } finally {
              setReportsLoading(false)
            }
          }
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setProfileData(null)
      setReports([])
      setDoctorMemo('')
      setSelectedReportForEval(null)
      setPreviewVisible(false)
      setActiveReportForPreview(null)
      setReportStatusMap({})
      setQuestionnaires([])
      setSelectedQuestionnaireId(null)
      setQuestionnaireModalVisible(false)
      setExportingQuestionnaireId(null)
      setSchemes([])
      setSelectedSchemeForPreview(null)
      setSelectedSchemeForEdit(null)
      setSchemePreviewVisible(false)
      setSchemeEditVisible(false)
      setDownloadingSchemeId(null)
    }
  }, [visible, activeCustomer?.id, activeCustomer?.customerId, activeCustomer?.mobile])

  // 获取该客户的健康生活问卷列表
  const fetchCustomerQuestionnairesData = async (
    targetCustomer?: CustomerRecord | null,
    statusFilter?: string
  ) => {
    const cust = targetCustomer || profileData || activeCustomer
    if (!cust) return

    try {
      setQuestionnairesLoading(true)
      const params: any = {}
      if (cust.mobile) {
        params.mobile = cust.mobile
      }
      if (cust.customerName) {
        params.userName = cust.customerName
      }
      if (cust.customerId) {
        params.customerId = cust.customerId
      }

      const activeStatus = statusFilter !== undefined ? statusFilter : questionnaireStatusFilter
      if (activeStatus && activeStatus !== 'all') {
        params.completionStatus = activeStatus
      }

      const res = await PatientService.getInstance().fetchCustomerQuestionnaires(params)
      setQuestionnaires(res.rows || [])
    } catch (err) {
      console.warn('fetchCustomerQuestionnairesData error:', err)
      setQuestionnaires([])
    } finally {
      setQuestionnairesLoading(false)
    }
  }

  // 刷新问卷列表
  const handleRefreshQuestionnaires = () => {
    const cust = profileData || activeCustomer
    if (!cust) return
    fetchCustomerQuestionnairesData(cust, questionnaireStatusFilter)
      .then(() => {
        message.success('健康生活问卷已刷新')
      })
      .catch(() => {
        message.error('刷新问卷失败')
      })
  }

  // 单行导出问卷 Excel
  const handleExportQuestionnaireRow = async (record: QuestionnaireRecord) => {
    try {
      setExportingQuestionnaireId(record.id)
      const cust = profileData || activeCustomer
      const userName = record.userName || cust?.customerName || '客户'
      const qName = record.questionnaireName || record.alias || '健康生活问卷'
      const timeStr = record.createTime ? `_${record.createTime.replace(/[\s:-]/g, '')}` : ''
      const defaultFileName = `${userName}_${qName}${timeStr}.xlsx`
      await PatientService.getInstance().exportQuestionnaireExcel(record.id, defaultFileName)
      message.success('问卷报告已导出')
    } catch (err) {
      message.error(`导出失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExportingQuestionnaireId(null)
    }
  }

  // 获取该客户的健管方案列表
  const fetchCustomerHealthSchemesData = async (targetCustomer?: CustomerRecord | null) => {
    const cust = targetCustomer || profileData || activeCustomer
    if (!cust) return

    try {
      setSchemesLoading(true)
      const params: any = {}
      if (cust.mobile) {
        params.mobile = cust.mobile
      }
      if (cust.customerName) {
        params.customerName = cust.customerName
      }
      const res = await PatientService.getInstance().fetchHealthSchemeList(params)
      setSchemes(res.rows || [])
    } catch (err) {
      console.warn('fetchCustomerHealthSchemesData error:', err)
      setSchemes([])
    } finally {
      setSchemesLoading(false)
    }
  }

  // 刷新健管方案
  const handleRefreshSchemes = () => {
    const cust = profileData || activeCustomer
    if (!cust) return
    fetchCustomerHealthSchemesData(cust).then(() => {
      message.success('健管方案列表已刷新')
    })
  }

  // 单行下载健管方案并记录下载次数
  const handleDownloadSchemeRow = async (record: HealthSchemeRecord) => {
    const pdfUrl = record.doctorFileUrl || record.fileUrl
    if (!pdfUrl) {
      message.warning('该方案暂无有效 PDF 附件')
      return
    }

    try {
      setDownloadingSchemeId(record.id)
      const custName = record.customerName || record.userName || '客户'
      const schemeTitle = record.recordsType === 6 ? '安颐健管方案' : '三师健管方案'
      const timeStr = (record.createTime || '').slice(0, 10).replace(/-/g, '')
      const fileName = `${custName}_${schemeTitle}_${timeStr || '方案'}.pdf`

      // 触发下载
      downloadFile(pdfUrl, fileName)

      // 上报后台增加下载计数
      if (record.id) {
        await PatientService.getInstance().recordHealthSchemeDownload(record.id)
        setSchemes(prev =>
          prev.map(item =>
            item.id === record.id
              ? { ...item, doctorDownload: (item.doctorDownload || 0) + 1 }
              : item
          )
        )
      }

      message.success('方案已下载并记录下载次数，可直接拖入企业微信发送给客户')
    } catch (err) {
      message.error(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloadingSchemeId(null)
    }
  }

  // 单独刷新体检报告
  const handleRefreshReports = () => {
    const cust = profileData || activeCustomer
    if (!cust) return

    // 核心修正：使用“健康档案详情”板块中的“系统档案编号”
    const systemArchiveId = cust.id ?? activeCustomer?.id
    if (systemArchiveId == null || systemArchiveId === '') {
      message.warning('当前客户缺少系统档案编号，无法获取体检报告')
      return
    }

    setReportsLoading(true)
    PatientService.getInstance()
      .fetchCustomerReports(systemArchiveId)
      .then(res => {
        const list = res || []
        setReports(list)
        message.success('体检报告列表已刷新')
        if (list.length > 0) {
          checkReportsStatus(list, cust)
        }
      })
      .catch(err => {
        console.warn('Refresh reports failed:', err)
        message.error('刷新报告列表失败')
      })
      .finally(() => {
        setReportsLoading(false)
      })
  }

  // 下载整份报告的所有附件并归档到本地
  const handleDownloadReport = async (record: MedicalReport) => {
    const cust = profileData || activeCustomer
    if (!cust) return
    const rawId = record.reportId ?? record.id
    if (!rawId) {
      message.warning('缺少报告编号')
      return
    }
    const urls = Array.isArray(record.fileUrls) ? record.fileUrls : []
    if (urls.length === 0) {
      message.info('该报告暂无源附件文件')
      return
    }

    setDownloadingReportId(rawId)
    const key = String(rawId)
    try {
      const resList = await reportFileService.downloadBatchFiles({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: rawId,
        reportDate: record.reportTime || record.uploadTime || record.createTime,
        medicalOrg: record.medicalOrg,
        fileUrls: urls,
      })

      const successCount = resList.filter(r => r.success).length
      const failedCount = resList.filter(r => !r.success).length

      if (failedCount === 0) {
        message.success(`体检报告附件下载完成 (${successCount} 个文件已归档)`)
      } else {
        message.warning(`归档完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
      }

      // 重新检查状态并更新
      const updatedStatus = await reportFileService.checkReportStatus({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: rawId,
        reportDate: record.reportTime || record.uploadTime || record.createTime,
        medicalOrg: record.medicalOrg,
        fileUrls: urls,
        remoteUpdateTime: record.updateTime || record.uploadTime || record.createTime,
      })
      setReportStatusMap(prev => ({ ...prev, [key]: updatedStatus }))
    } catch (err: any) {
      message.error(`报告归档失败: ${err?.message || err}`)
    } finally {
      setDownloadingReportId(null)
    }
  }

  // 打开指定报告的本地目录
  const handleOpenReportFolder = async (record: MedicalReport) => {
    const cust = profileData || activeCustomer
    if (!cust) return
    const rawId = record.reportId ?? record.id
    if (!rawId) {
      message.warning('缺少报告编号')
      return
    }
    const key = String(rawId)
    let status = reportStatusMap[key]

    try {
      if (!status || !status.reportDir) {
        status = await reportFileService.checkReportStatus({
          customerId: cust.id ?? cust.customerId ?? '',
          customerName: cust.customerName || '未命名',
          mobile: cust.mobile || '',
          reportId: rawId,
          reportDate: record.reportTime || record.uploadTime || record.createTime,
          medicalOrg: record.medicalOrg,
          fileUrls: Array.isArray(record.fileUrls) ? record.fileUrls : [],
          remoteUpdateTime: record.updateTime || record.uploadTime || record.createTime,
        })
        setReportStatusMap(prev => ({ ...prev, [key]: status }))
      }

      await reportFileService.openLocalFolder(status.reportDir)
    } catch (err: any) {
      message.error(`打开本地目录失败: ${err?.message || err}`)
    }
  }

  // 打开该客户专属的报告归档根目录
  const handleOpenCustomerFolder = async () => {
    const cust = profileData || activeCustomer
    if (!cust) return
    try {
      const dummyStatus = await reportFileService.checkReportStatus({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: '__customer_root__',
        fileUrls: [],
      })
      const custDir = dummyStatus.reportDir.replace(/[\\/][^\\/]+$/, '')
      await reportFileService.openLocalFolder(custDir)
    } catch (err: any) {
      message.error(`打开客户报告目录失败: ${err?.message || err}`)
    }
  }

  // 单个文件下载并立即在本地打开
  const handleDownloadAndOpenFile = async (record: MedicalReport, fileUrl: string) => {
    const cust = profileData || activeCustomer
    if (!cust) return
    const rawId = record.reportId ?? record.id
    if (!rawId) {
      message.warning('缺少报告编号')
      return
    }
    setSingleFileLoading(prev => ({ ...prev, [fileUrl]: true }))
    try {
      const res = await reportFileService.downloadSingleFile({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: rawId,
        reportDate: record.reportTime || record.uploadTime || record.createTime,
        medicalOrg: record.medicalOrg,
        fileUrl,
      })
      if (!res.success) {
        throw new Error(res.error || '下载文件失败')
      }
      message.success('文件下载完成')
      // 调用本地程序打开
      await reportFileService.openLocalFile(res.localPath)

      // 刷新本报告状态
      const updatedStatus = await reportFileService.checkReportStatus({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: rawId,
        reportDate: record.reportTime || record.uploadTime || record.createTime,
        medicalOrg: record.medicalOrg,
        fileUrls: Array.isArray(record.fileUrls) ? record.fileUrls : [],
        remoteUpdateTime: record.updateTime || record.uploadTime || record.createTime,
      })
      setReportStatusMap(prev => ({ ...prev, [String(rawId)]: updatedStatus }))
    } catch (err: any) {
      message.error(`打开或下载文件失败: ${err?.message || err}`)
    } finally {
      setSingleFileLoading(prev => ({ ...prev, [fileUrl]: false }))
    }
  }

  // 直接通过系统默认程序打开本地已存在文件
  const handleOpenLocalExistingFile = async (localPath: string) => {
    try {
      await reportFileService.openLocalFile(localPath)
    } catch (err: any) {
      message.error(`打开本地文件失败: ${err?.message || err}`)
    }
  }

  // 在资源管理器中选中并定位文件
  const handleOpenLocalExistingFolder = async (localPathOrDir: string) => {
    try {
      await reportFileService.openLocalFolder(localPathOrDir)
    } catch (err: any) {
      message.error(`定位文件夹失败: ${err?.message || err}`)
    }
  }

  // 打开报告源文件预览弹窗
  const handleOpenPreview = (record: MedicalReport) => {
    const urls = Array.isArray(record.fileUrls) ? record.fileUrls : []
    if (urls.length === 0) {
      message.info('该报告暂无源附件文件')
      return
    }
    setActiveReportForPreview(record)
    setPreviewFiles(urls)
    setPreviewVisible(true)
  }

  // 分离报告附件：图片与文档
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
  const pictureFiles = useMemo(() => {
    return previewFiles.filter(url => {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
      return imageExtensions.includes(ext)
    })
  }, [previewFiles])

  const documentFiles = useMemo(() => {
    return previewFiles.filter(url => {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
      return !imageExtensions.includes(ext)
    })
  }, [previewFiles])

  // 保存医生便签
  const handleSaveMemo = () => {
    if (!activeCustomer) return
    setMemoSaving(true)
    try {
      const memoKey = `doctor_memo_cust_${activeCustomer.id}`
      localStorage.setItem(memoKey, doctorMemo)
      message.success('医生随访便签保存成功')
    } catch {
      message.error('便签保存失败')
    } finally {
      setMemoSaving(false)
    }
  }

  if (!activeCustomer && !profileData) {
    return null
  }

  const current = profileData || activeCustomer!

  const abTags = current.abTag
    ? current.abTag.split(',').filter(Boolean)
    : []
  const diTags = current.diTag
    ? current.diTag.split(',').filter(Boolean)
    : []
  const chTags = current.chTag
    ? current.chTag.split(',').filter(Boolean)
    : []

  const genderText =
    current.gender === 1 || current.gender === '1'
      ? '男'
      : current.gender === 2 || current.gender === '2'
        ? '女'
        : '未知'

  return (
    <Drawer
      title="客户完整档案与健康履历"
      placement="right"
      width={800}
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          {onScheduleAppointment && (
            <Button
              type="primary"
              icon={<BellOutlined />}
              onClick={() => {
                onScheduleAppointment(current)
              }}
            >
              快速设置提醒
            </Button>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 顶部客户名片 */}
        <Card
          bordered={false}
          style={{
            background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f7ff 100%)',
            borderRadius: 8,
            marginBottom: 16,
          }}
          styles={{ body: { padding: 18 } }}
        >
          <Row gutter={16} align="middle">
            <Col>
              <Avatar
                size={64}
                icon={<UserOutlined />}
                style={{
                  backgroundColor: '#1890ff',
                  boxShadow: '0 4px 10px rgba(24, 144, 255, 0.3)',
                }}
              />
            </Col>
            <Col flex="1">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {resolveCustomerDisplayName(current)}
                </Title>
                <Tag color="blue">{genderText}</Tag>
                {current.age && <Tag color="cyan">{current.age} 岁</Tag>}
                {current.vipName && (
                  <Tag color="gold" style={{ fontWeight: 600 }}>
                    {current.vipName}
                  </Tag>
                )}
                {current.bankLabel && (
                  <Tag color="green" style={{ fontWeight: 500 }}>
                    {current.bankLabel}
                  </Tag>
                )}
              </div>
              <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                <Space size="large" wrap>
                  <span>
                    <PhoneOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {current.mobile || '无联系方式'}
                  </span>
                  <span>
                    <IdcardOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {current.idCardNo || '未登记身份证'}
                  </span>
                </Space>
              </div>
              {(current.topCompanyName || current.subCompanyName) && (
                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                  单位/机构：
                  {[current.topCompanyName, current.companyName, current.subCompanyName]
                    .filter(Boolean)
                    .join(' - ')}
                </div>
              )}
            </Col>
          </Row>

          <Divider style={{ margin: '14px 0 10px 0' }} />

          {/* 异常指标与慢病预警 */}
          <div>
            <Text strong style={{ fontSize: 13, marginRight: 8 }}>
              健康异常标识：
            </Text>
            {abTags.length === 0 && diTags.length === 0 && chTags.length === 0 ? (
              <Tag color="success">暂无明显异常标识</Tag>
            ) : (
              <Space wrap size={[6, 6]}>
                {abTags.map(tag => (
                  <Tag color="error" key={`ab_${tag}`}>
                    {tag}
                  </Tag>
                ))}
                {diTags.map(tag => (
                  <Tag color="magenta" key={`di_${tag}`}>
                    {tag}
                  </Tag>
                ))}
                {chTags.map(tag => (
                  <Tag color="orange" key={`ch_${tag}`}>
                    {tag}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        </Card>

        {/* 专属服务团队卡片 */}
        <Card
          size="small"
          title={
            <span>
              <TeamOutlined style={{ color: '#1890ff', marginRight: 6 }} />
              专属多学科管理团队
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="专属医师">
              <Text strong style={{ color: '#1890ff' }}>
                {current.ownerPhysicianName || '暂未分配'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="专属健管师">
              {current.ownerCsName || '暂未分配'}
            </Descriptions.Item>
            <Descriptions.Item label="健康管家/护士">
              {current.ownerNurseName || '暂未分配'}
            </Descriptions.Item>
            <Descriptions.Item label="专属营养师">
              {current.ownerDietitianName || '暂未分配'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 档案核心功能 Tabs */}
        <Tabs
          defaultActiveKey="profile"
          items={[
            {
              key: 'profile',
              label: '健康档案详情',
              children: (
                <Card size="small" bordered={false}>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="过敏史">
                      {current.allergyHistory || '无过敏记录'}
                    </Descriptions.Item>
                    <Descriptions.Item label="既往病史">
                      {current.pastHistory || '无重大既往病史'}
                    </Descriptions.Item>
                    <Descriptions.Item label="家族病史">
                      {current.familyHistory || '无家族病史记录'}
                    </Descriptions.Item>
                    <Descriptions.Item label="体检报告上传状态">
                      <Tag color={current.hasReport === 1 ? 'green' : 'default'}>
                        {current.hasReport === 1 ? '已上传报告' : '未上传'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="建档时间">
                      {current.createTime || '无建档时间'}
                    </Descriptions.Item>
                    <Descriptions.Item label="系统档案编号">
                      {String(current.id ?? current.customerId ?? '-')}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
            {
              key: 'medicalReports',
              label: (
                <span>
                  <FileTextOutlined />
                  体检报告 ({reports.length})
                </span>
              ),
              children: (
                <div style={{ padding: '4px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      从后台同步的历次健康体检、理化指标及报告原件，支持本地智能归档与秒开
                    </Text>
                    <Space size="small">
                      <Button
                        type="primary"
                        size="small"
                        icon={<UploadOutlined />}
                        onClick={() => setUploadModalVisible(true)}
                      >
                        上传报告
                      </Button>
                      <Button
                        size="small"
                        icon={<FolderOpenOutlined />}
                        onClick={handleOpenCustomerFolder}
                      >
                        打开客户报告目录
                      </Button>
                      <Button
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => setStorageModalVisible(true)}
                      >
                        存储设置
                      </Button>
                      <Button
                        size="small"
                        icon={<ReloadOutlined spin={reportsLoading} />}
                        onClick={handleRefreshReports}
                      >
                        刷新
                      </Button>
                    </Space>
                  </div>

                  <Table
                    columns={[
                      {
                        title: '报告名称 / 编号',
                        dataIndex: 'reportId',
                        key: 'reportId',
                        width: 150,
                        render: (text: any, record: MedicalReport) => (
                          <div>
                            <Text strong style={{ fontSize: 13 }}>
                              {record.reportName || text || record.id || '-'}
                            </Text>
                            {record.reportName && (text || record.id) && (
                              <div style={{ fontSize: 11, color: '#888' }}>
                                ID: {text || record.id}
                              </div>
                            )}
                            {record.anyiHealth && (
                              <Tag color="warning" style={{ marginTop: 2, transform: 'scale(0.85)', transformOrigin: 'left center' }}>
                                安颐健康
                              </Tag>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: '类型',
                        dataIndex: 'reportType',
                        key: 'reportType',
                        width: 85,
                        render: (type: any) => {
                          const num = Number(type)
                          if (num === 1) return <Tag color="blue">体检报告</Tag>
                          if (num === 2) return <Tag color="cyan">理化指标</Tag>
                          if (num === 3) return <Tag color="default">无就医记录</Tag>
                          return <Tag color="blue">{type || '体检报告'}</Tag>
                        },
                      },
                      {
                        title: '机构 / 日期',
                        key: 'orgTime',
                        minWidth: 120,
                        render: (_: any, record: MedicalReport) => (
                          <div style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 500, color: '#333' }}>
                              {record.medicalOrg || '未标注机构'}
                            </div>
                            <div style={{ color: '#888', marginTop: 2 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {record.reportTime || record.uploadTime || '-'}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: '本地归档状态',
                        key: 'localStatus',
                        width: 140,
                        render: (_: any, record: MedicalReport) => {
                          const repId = record.reportId ?? record.id
                          const isDownloading = downloadingReportId === repId
                          if (isDownloading) {
                            return <Tag icon={<SyncOutlined spin />} color="processing">同步下载中...</Tag>
                          }
                          const status = reportStatusMap[String(repId)]
                          if (!status) {
                            return <Text type="secondary" style={{ fontSize: 12 }}>检测中...</Text>
                          }
                          const total = status.files?.length || 0
                          const localCount = status.files?.filter(f => f.exists).length || 0

                          if (total === 0) {
                            return <Tag color="default">无附件</Tag>
                          }

                          if (status.hasUpdates) {
                            return (
                              <Tooltip title="云端有较新报告或文件更新，建议重新同步">
                                <Tag icon={<SyncOutlined />} color="warning">
                                  有更新 ({localCount}/{total})
                                </Tag>
                              </Tooltip>
                            )
                          }

                          if (status.allDownloaded || (total > 0 && localCount === total)) {
                            return (
                              <Tooltip title={`本地已归档 (${localCount}/${total})，存放于: ${status.reportDir}`}>
                                <Tag icon={<CheckCircleOutlined />} color="success">
                                  已归档 ({localCount}/{total})
                                </Tag>
                              </Tooltip>
                            )
                          }

                          if (localCount > 0) {
                            return (
                              <Tooltip title={`部分文件已下载 (${localCount}/${total})`}>
                                <Tag color="orange">
                                  部分下载 ({localCount}/{total})
                                </Tag>
                              </Tooltip>
                            )
                          }

                          return <Tag color="default">未下载到本地</Tag>
                        },
                      },
                      {
                        title: 'OCR状态',
                        key: 'orcStatus',
                        width: 80,
                        render: (_: any, record: MedicalReport) => {
                          if (record.orcStatus === 1) return <Tag color="processing">识别中</Tag>
                          if (record.orcStatus === 2) return <Tag color="success">已完成</Tag>
                          if (record.orcStatus === 3) return <Tag color="error">识别失败</Tag>
                          return <Tag>未开始</Tag>
                        },
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 195,
                        fixed: 'right' as const,
                        render: (_: any, record: MedicalReport) => {
                          const repId = record.reportId ?? record.id
                          const fileCount = Array.isArray(record.fileUrls) ? record.fileUrls.length : 0
                          const status = reportStatusMap[String(repId)]
                          const isDownloading = downloadingReportId === repId
                          const isReady = status?.allDownloaded

                          return (
                            <Space size={2} wrap>
                              <Button
                                type="link"
                                size="small"
                                icon={<EyeOutlined />}
                                disabled={fileCount === 0}
                                onClick={() => handleOpenPreview(record)}
                              >
                                查看 ({fileCount})
                              </Button>
                              {fileCount > 0 && (
                                <Tooltip title={isReady ? '重新下载所有附件' : '一键归档所有附件至本地'}>
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={status?.hasUpdates ? <SyncOutlined /> : <DownloadOutlined />}
                                    loading={isDownloading}
                                    style={status?.hasUpdates ? { color: '#fa8c16' } : undefined}
                                    onClick={() => handleDownloadReport(record)}
                                  >
                                    {status?.hasUpdates
                                      ? '更新'
                                      : isReady
                                        ? '重下'
                                        : '归档'}
                                  </Button>
                                </Tooltip>
                              )}
                              <Tooltip title="在 Windows 资源管理器中打开报告文件夹">
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<FolderOpenOutlined />}
                                  onClick={() => handleOpenReportFolder(record)}
                                >
                                  定位
                                </Button>
                              </Tooltip>
                              <Button
                                type="link"
                                size="small"
                                icon={<FileTextOutlined />}
                                onClick={() => setSelectedReportForEval(record)}
                              >
                                诊评
                              </Button>
                            </Space>
                          )
                        },
                      },
                    ]}
                    dataSource={reports}
                    rowKey={record => String(record.id ?? record.reportId ?? Math.random())}
                    loading={reportsLoading}
                    size="small"
                    pagination={
                      reports.length > 5
                        ? { pageSize: 5, showTotal: total => `共 ${total} 份报告` }
                        : false
                    }
                    locale={{
                      emptyText: (
                        <Empty
                          description="暂无关联体检报告或尚未上传 OCR 文件"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        >
                          <Button
                            type="primary"
                            size="small"
                            icon={<UploadOutlined />}
                            onClick={() => setUploadModalVisible(true)}
                          >
                            为该客户上传体检报告
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'questionnaires',
              label: (
                <span>
                  <ProfileOutlined />
                  健康生活问卷 ({questionnaires.length})
                </span>
              ),
              children: (
                <div style={{ padding: '4px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      展示该客户历次填写的健康生活方式与满意度问卷，支持答题详情穿透查阅与 Excel 导出
                    </Text>
                    <Space size="small">
                      <Select
                        size="small"
                        style={{ width: 110 }}
                        value={questionnaireStatusFilter}
                        onChange={val => {
                          setQuestionnaireStatusFilter(val)
                          fetchCustomerQuestionnairesData(profileData || activeCustomer, val)
                        }}
                        options={[
                          { label: '全部状态', value: 'all' },
                          { label: '已完成', value: '2' },
                          { label: '未完成', value: '1' },
                        ]}
                      />
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={questionnairesLoading}
                        onClick={handleRefreshQuestionnaires}
                      >
                        刷新问卷
                      </Button>
                    </Space>
                  </div>

                  <Table
                    dataSource={questionnaires}
                    rowKey={record => String(record.id)}
                    loading={questionnairesLoading}
                    pagination={
                      questionnaires.length > 5
                        ? { pageSize: 5, size: 'small', showTotal: total => `共 ${total} 份问卷` }
                        : false
                    }
                    size="small"
                    columns={[
                      {
                        title: '问卷名称',
                        dataIndex: 'questionnaireName',
                        key: 'questionnaireName',
                        render: (text: string, record: QuestionnaireRecord) => (
                          <Space direction="vertical" size={2}>
                            <span style={{ fontWeight: 500, color: '#1890ff' }}>
                              {text || record.alias || '健康生活问卷'}
                            </span>
                            {record.questionCode && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                代码: {record.questionCode}
                              </Text>
                            )}
                          </Space>
                        ),
                      },
                      {
                        title: '填写人',
                        dataIndex: 'userName',
                        key: 'userName',
                        width: 100,
                        render: (text: string) => text || current.customerName || '-',
                      },
                      {
                        title: '联系手机',
                        dataIndex: 'mobile',
                        key: 'mobile',
                        width: 130,
                        render: (text: string) => text || current.mobile || '-',
                      },
                      {
                        title: '完成状态',
                        dataIndex: 'completionStatus',
                        key: 'completionStatus',
                        width: 90,
                        render: (status: number | string) => {
                          const isDone = status === 2 || status === '2'
                          return (
                            <Tag color={isDone ? 'success' : 'warning'}>
                              {isDone ? '已完成' : '未完成'}
                            </Tag>
                          )
                        },
                      },
                      {
                        title: '填写时间',
                        dataIndex: 'createTime',
                        key: 'createTime',
                        width: 160,
                        render: (text: string) => text || '-',
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 130,
                        align: 'center',
                        render: (_: any, record: QuestionnaireRecord) => {
                          const isDone =
                            record.completionStatus === 2 || record.completionStatus === '2'
                          const isExp = exportingQuestionnaireId === record.id
                          return (
                            <Space size="small">
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0 }}
                                onClick={() => {
                                  setSelectedQuestionnaireId(record.id)
                                  setQuestionnaireModalVisible(true)
                                }}
                              >
                                详情
                              </Button>
                              {isDone && (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  loading={isExp}
                                  onClick={() => handleExportQuestionnaireRow(record)}
                                >
                                  导出
                                </Button>
                              )}
                            </Space>
                          )
                        },
                      },
                    ]}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="该客户暂未填写健康生活问卷"
                        />
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'schemes',
              label: (
                <span>
                  <SolutionOutlined />
                  健管方案 ({schemes.length})
                </span>
              ),
              children: (
                <div style={{ padding: '4px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      三师健管系统自动排版生成的定制化干预方案，支持即时预览、在线修改重新生成与下载发微信
                    </Text>
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={schemesLoading}
                      onClick={handleRefreshSchemes}
                    >
                      刷新方案
                    </Button>
                  </div>

                  <Table
                    dataSource={schemes}
                    rowKey={record => String(record.id)}
                    loading={schemesLoading}
                    pagination={
                      schemes.length > 5
                        ? { pageSize: 5, size: 'small', showTotal: total => `共 ${total} 份方案` }
                        : false
                    }
                    size="small"
                    columns={[
                      {
                        title: '方案标识',
                        dataIndex: 'recordsType',
                        key: 'recordsType',
                        width: 95,
                        render: (type: number) => (
                          <Tag color={type === 6 ? 'volcano' : 'blue'}>
                            {type === 6 ? '安颐健康' : '三好卡'}
                          </Tag>
                        ),
                      },
                      {
                        title: '服务类型',
                        dataIndex: 'codeType',
                        key: 'codeType',
                        width: 125,
                        render: (codeType: any) => getSchemeServiceTypeName(codeType),
                      },
                      {
                        title: '审核状态',
                        dataIndex: 'auditStatus',
                        key: 'auditStatus',
                        width: 105,
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
                        width: 95,
                        render: (name: string, record: HealthSchemeRecord) =>
                          name || record.ownerPhysicianName || '-',
                      },
                      {
                        title: '下载次数',
                        dataIndex: 'doctorDownload',
                        key: 'doctorDownload',
                        width: 85,
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
                        title: '生成时间',
                        dataIndex: 'createTime',
                        key: 'createTime',
                        width: 155,
                        render: (time: string) => time || '-',
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 185,
                        align: 'center',
                        render: (_: any, record: HealthSchemeRecord) => {
                          const isDownloading = downloadingSchemeId === record.id
                          const isRegenerating = record.async === 1

                          return (
                            <Space size="small">
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0 }}
                                onClick={() => {
                                  setSelectedSchemeForPreview(record)
                                  setSchemePreviewVisible(true)
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
                                  setSelectedSchemeForEdit(record)
                                  setSchemeEditVisible(true)
                                }}
                              >
                                修改
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0 }}
                                loading={isDownloading}
                                onClick={() => handleDownloadSchemeRow(record)}
                              >
                                下载发客户
                              </Button>
                            </Space>
                          )
                        },
                      },
                    ]}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="该客户暂未生成三师健管方案"
                        />
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'memo',
              label: '医生随访便签 (本地记事)',
              children: (
                <Card size="small" title="医生工作随手记 (本地即时保存，替代纸质本)" bordered={false}>
                  <Paragraph type="secondary" style={{ fontSize: 12 }}>
                    随时记录与客户沟通的健康指标变化、个性化饮食方案或复查提醒。
                  </Paragraph>
                  <TextArea
                    rows={6}
                    placeholder="输入该客户的随访要点、用药禁忌或预约备忘..."
                    value={doctorMemo}
                    onChange={e => setDoctorMemo(e.target.value)}
                  />
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={memoSaving}
                      onClick={handleSaveMemo}
                    >
                      保存便签
                    </Button>
                  </div>
                </Card>
              ),
            },
          ]}
        />
      </Spin>

      {/* 报告源文件/附件预览弹窗 */}
      <Modal
        title={
          <Space>
            <FileSearchOutlined style={{ color: '#1890ff' }} />
            <span>报告原件与附件预览</span>
            {activeReportForPreview?.reportName && (
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
                - {activeReportForPreview.reportName}
              </Text>
            )}
          </Space>
        }
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false)
          setActiveReportForPreview(null)
        }}
        footer={[
          activeReportForPreview && (
            <Button
              key="download-all"
              icon={<DownloadOutlined />}
              loading={downloadingReportId === (activeReportForPreview.reportId ?? activeReportForPreview.id)}
              onClick={() => handleDownloadReport(activeReportForPreview)}
            >
              {reportStatusMap[String(activeReportForPreview.reportId ?? activeReportForPreview.id)]?.allDownloaded
                ? '重新下载全部附件'
                : '一键归档全部附件'}
            </Button>
          ),
          activeReportForPreview && (
            <Button
              key="open-dir"
              icon={<FolderOpenOutlined />}
              onClick={() => handleOpenReportFolder(activeReportForPreview)}
            >
              打开所在文件夹
            </Button>
          ),
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setPreviewVisible(false)
              setActiveReportForPreview(null)
            }}
          >
            关闭
          </Button>,
        ]}
        width={680}
      >
        {activeReportForPreview && (
          <div
            style={{
              background: '#f6f9fc',
              padding: '8px 12px',
              borderRadius: 6,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              border: '1px solid #e6f0fa',
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, flex: 1 }}>
              <Text type="secondary">本地归档目录：</Text>
              <Text
                code
                copyable={{
                  text: reportStatusMap[String(activeReportForPreview.reportId ?? activeReportForPreview.id)]?.reportDir || '',
                }}
              >
                {reportStatusMap[String(activeReportForPreview.reportId ?? activeReportForPreview.id)]?.reportDir || '检测中...'}
              </Text>
            </div>
            <Button
              type="link"
              size="small"
              icon={<FolderOpenOutlined />}
              style={{ padding: 0 }}
              onClick={() => handleOpenReportFolder(activeReportForPreview)}
            >
              打开目录
            </Button>
          </div>
        )}

        {pictureFiles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>
                体检图片 ({pictureFiles.length} 张，点击图片可放大缩放预览)
              </Text>
            </div>
            <Image.PreviewGroup>
              <Space wrap size={[12, 12]}>
                {pictureFiles.map((url, idx) => {
                  const repId = activeReportForPreview ? String(activeReportForPreview.reportId ?? activeReportForPreview.id) : ''
                  const st = reportStatusMap[repId]
                  const matched = st?.files?.find(f => f.url === url)
                  const isLocal = matched?.exists

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: 120,
                        padding: 6,
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        background: '#fafafa',
                      }}
                    >
                      <Image
                        width={108}
                        height={108}
                        src={url}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                      <div style={{ marginTop: 6, width: '100%', textAlign: 'center' }}>
                        {isLocal ? (
                          <Space size={2}>
                            <Tag color="success" style={{ margin: 0, fontSize: 10 }}>已归档</Tag>
                            <Tooltip title="在文件夹中定位此图片">
                              <Button
                                type="text"
                                size="small"
                                icon={<FolderViewOutlined />}
                                style={{ padding: '0 4px', fontSize: 12 }}
                                onClick={() => matched && handleOpenLocalExistingFolder(matched.localPath)}
                              />
                            </Tooltip>
                          </Space>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            loading={singleFileLoading[url]}
                            style={{ padding: 0, fontSize: 11 }}
                            onClick={() => activeReportForPreview && handleDownloadAndOpenFile(activeReportForPreview, url)}
                          >
                            下载并打开
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </Space>
            </Image.PreviewGroup>
          </div>
        )}

        {documentFiles.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              PDF 或文档附件 ({documentFiles.length} 份)
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              {documentFiles.map((url, idx) => {
                const fileName = url.split('?')[0].split('/').pop() || `附件_${idx + 1}`
                const repId = activeReportForPreview ? String(activeReportForPreview.reportId ?? activeReportForPreview.id) : ''
                const st = reportStatusMap[repId]
                const matched = st?.files?.find(f => f.url === url)
                const isLocal = matched?.exists

                return (
                  <Card key={idx} size="small" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 22 }} />
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>
                            {fileName}
                            {isLocal ? (
                              <Tag color="success" style={{ marginLeft: 8 }}>
                                本地已就绪 {matched?.fileSize ? `(${Math.round(matched.fileSize / 1024)} KB)` : ''}
                              </Tag>
                            ) : (
                              <Tag color="default" style={{ marginLeft: 8 }}>未下载到本地</Tag>
                            )}
                          </div>
                          {isLocal && (
                            <div style={{ fontSize: 11, color: '#888', marginTop: 2, wordBreak: 'break-all' }}>
                              路径: {matched.localPath}
                            </div>
                          )}
                        </div>
                      </Space>
                      <Space>
                        {isLocal ? (
                          <>
                            <Button
                              type="primary"
                              size="small"
                              icon={<FileSearchOutlined />}
                              onClick={() => handleOpenLocalExistingFile(matched.localPath)}
                            >
                              本地秒开
                            </Button>
                            <Tooltip title="在文件夹中选中此文件">
                              <Button
                                size="small"
                                icon={<FolderViewOutlined />}
                                onClick={() => handleOpenLocalExistingFolder(matched.localPath)}
                              >
                                定位
                              </Button>
                            </Tooltip>
                            <Tooltip title="重新从云端下载并覆盖">
                              <Button
                                size="small"
                                icon={<SyncOutlined />}
                                loading={singleFileLoading[url]}
                                onClick={() => activeReportForPreview && handleDownloadAndOpenFile(activeReportForPreview, url)}
                              />
                            </Tooltip>
                          </>
                        ) : (
                          <Button
                            type="primary"
                            size="small"
                            icon={<DownloadOutlined />}
                            loading={singleFileLoading[url]}
                            onClick={() => activeReportForPreview && handleDownloadAndOpenFile(activeReportForPreview, url)}
                          >
                            下载至本地并打开
                          </Button>
                        )}
                      </Space>
                    </div>
                  </Card>
                )
              })}
            </Space>
          </div>
        )}

        {pictureFiles.length === 0 && documentFiles.length === 0 && (
          <Empty description="该报告暂无可预览的附件" />
        )}
      </Modal>

      {/* 存储设置弹窗 */}
      <ReportStorageSettingModal
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
      />

      {/* 上传体检报告弹窗 */}
      <UploadMedicalReportModal
        visible={uploadModalVisible}
        customer={profileData || activeCustomer}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          handleRefreshReports()
        }}
      />

      {/* 健康生活问卷详情弹窗 */}
      <QuestionnaireDetailModal
        visible={questionnaireModalVisible}
        questionnaireId={selectedQuestionnaireId}
        onClose={() => {
          setQuestionnaireModalVisible(false)
          setSelectedQuestionnaireId(null)
        }}
      />

      {/* 报告诊评意见弹窗 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>体检报告临床诊评</span>
          </Space>
        }
        open={Boolean(selectedReportForEval)}
        onCancel={() => setSelectedReportForEval(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedReportForEval(null)}>
            确认
          </Button>,
        ]}
        width={560}
      >
        {selectedReportForEval && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="报告编号">
                {selectedReportForEval.reportId || selectedReportForEval.id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="报告类型">
                {selectedReportForEval.reportType === 2
                  ? '理化指标'
                  : selectedReportForEval.reportType === 3
                    ? '免回复无就医记录'
                    : '体检报告'}
              </Descriptions.Item>
              <Descriptions.Item label="体检机构">
                {selectedReportForEval.medicalOrg || '未录入机构'}
              </Descriptions.Item>
              <Descriptions.Item label="体检日期">
                {selectedReportForEval.reportTime || '-'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 6 }}>
              <Text strong style={{ fontSize: 14 }}>
                临床评估与诊评诊断意见：
              </Text>
            </div>
            <div
              style={{
                background: '#f8fafd',
                border: '1px solid #e6f0fa',
                borderRadius: 6,
                padding: '12px 14px',
                minHeight: 120,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: selectedReportForEval.clinicalEvaluation ? '#333' : '#999',
              }}
            >
              {selectedReportForEval.clinicalEvaluation ||
                '该报告暂无医生录入的临床评估意见。'}
            </div>
          </div>
        )}
      </Modal>

      {/* 健管方案预览与下载弹窗 */}
      <HealthSchemePreviewModal
        visible={schemePreviewVisible}
        schemeRecord={selectedSchemeForPreview}
        onClose={() => {
          setSchemePreviewVisible(false)
          setSelectedSchemeForPreview(null)
        }}
        onEdit={record => {
          setSchemePreviewVisible(false)
          setSelectedSchemeForEdit(record)
          setSchemeEditVisible(true)
        }}
        onDownloadSuccess={schemeId => {
          setSchemes(prev =>
            prev.map(item =>
              item.id === schemeId
                ? { ...item, doctorDownload: (item.doctorDownload || 0) + 1 }
                : item
            )
          )
        }}
      />

      {/* 健管方案快速修改与重新生成弹窗 */}
      <EditHealthSchemeModal
        visible={schemeEditVisible}
        schemeRecord={selectedSchemeForEdit}
        onClose={() => {
          setSchemeEditVisible(false)
          setSelectedSchemeForEdit(null)
        }}
        onSuccess={() => {
          handleRefreshSchemes()
        }}
      />
    </Drawer>
  )
}
