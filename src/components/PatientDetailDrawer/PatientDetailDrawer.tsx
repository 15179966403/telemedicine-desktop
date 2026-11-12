import React, { useState, useEffect } from 'react'
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
  Select,
  Badge,
  Tooltip,
  Popconfirm,
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
  UploadOutlined,
  ProfileOutlined,
  SolutionOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { CustomerRecord, Patient, MedicalReport, QuestionnaireRecord, HealthSchemeRecord } from '@/types'
import { PatientService } from '@/services/patientService'
import { ReportFileService, ReportStatusResult, SchemeStatusResult, DictService, type DictItem } from '@/services'
import { UploadMedicalReportModal } from '@/components/UploadMedicalReportModal'
import { MedicalReportPreviewModal } from '@/components/MedicalReportPreviewModal'
import { ReportStorageSettingModal } from '@/components/ReportStorageSettingModal'
import { QuestionnaireDetailModal } from '@/components/QuestionnaireDetailModal'
import { EditHealthSchemeModal, HealthSchemePreviewModal } from '@/components/HealthScheme'
import { resolveCustomerDisplayName } from '@/components/AppointmentModal/AppointmentModal'
import { downloadFile, buildHealthSchemeFileName } from '@/utils/helpers'

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
  const [reportStatusMap, setReportStatusMap] = useState<Record<string, ReportStatusResult>>({})
  const [downloadingReportId, setDownloadingReportId] = useState<string | number | null>(null)
  const [storageModalVisible, setStorageModalVisible] = useState(false)
  const [cleaningReportId, setCleaningReportId] = useState<string | number | null>(null)
  const [cleaningCustomerId, setCleaningCustomerId] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [reportPreviewVisible, setReportPreviewVisible] = useState(false)
  const [selectedReportForPreview, setSelectedReportForPreview] = useState<MedicalReport | null>(null)
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
  const [cleaningSchemeId, setCleaningSchemeId] = useState<string | number | null>(null)
  const [schemeStatusMap, setSchemeStatusMap] = useState<Record<string, SchemeStatusResult>>({})
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
      setReportPreviewVisible(false)
      setSelectedReportForPreview(null)
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
      setCleaningSchemeId(null)
      setSchemeStatusMap({})
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

  // 批量检查健管方案本地存储状态
  const checkSchemesStatus = async (
    schemeList: HealthSchemeRecord[],
    cust: CustomerRecord
  ) => {
    if (!schemeList || schemeList.length === 0) return
    const newMap: Record<string, SchemeStatusResult> = {}
    await Promise.allSettled(
      schemeList.map(async s => {
        if (!s.id) return
        const key = String(s.id)
        const fileName = buildHealthSchemeFileName(s)
        try {
          const st = await reportFileService.checkSchemeStatus({
            customerId: cust.id ?? cust.customerId ?? '',
            customerName: s.customerName || cust.customerName || '客户',
            mobile: cust.mobile || s.mobile || '',
            schemeId: s.id,
            fileName,
          })
          newMap[key] = st
        } catch (e) {
          console.warn('Check scheme file status failed for schemeId:', s.id, e)
        }
      })
    )
    setSchemeStatusMap(prev => ({ ...prev, ...newMap }))
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
      const list = res.rows || []
      setSchemes(list)
      if (list.length > 0) {
        checkSchemesStatus(list, cust)
      }
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

  // 单行下载健管方案并归档至本地，并记录下载次数
  const handleDownloadSchemeRow = async (record: HealthSchemeRecord) => {
    const pdfUrl = record.doctorFileUrl || record.fileUrl
    if (!pdfUrl) {
      message.warning('该方案暂无有效 PDF 附件')
      return
    }
    const cust = profileData || activeCustomer
    if (!cust) return

    try {
      setDownloadingSchemeId(record.id)
      const fileName = buildHealthSchemeFileName(record)

      // 1. 本地归档下载至客户专属目录下的“健管方案”子目录
      let downloadedLocally = false
      try {
        const res = await reportFileService.downloadSchemeFile({
          customerId: cust.id ?? cust.customerId ?? '',
          customerName: record.customerName || cust.customerName || '客户',
          mobile: cust.mobile || record.mobile || '',
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

      // 2. 上报后台增加下载计数
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

      // 3. 刷新本地状态
      await checkSchemesStatus(schemes, cust)

      message.success({
        content: (
          <span>
            <b>方案已保存至本地客户文件夹！</b> 已记录系统下载计数，您可直接将文件发给客户。
          </span>
        ),
        duration: 3,
      })
    } catch (err) {
      message.error(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloadingSchemeId(null)
    }
  }

  // 在 Windows 资源管理器中打开/定位健管方案文件夹
  const handleOpenSchemeFolder = async (record: HealthSchemeRecord) => {
    const cust = profileData || activeCustomer
    if (!cust) return
    const key = String(record.id)
    let status = schemeStatusMap[key]

    try {
      if (!status) {
        const fileName = buildHealthSchemeFileName(record)
        status = await reportFileService.checkSchemeStatus({
          customerId: cust.id ?? cust.customerId ?? '',
          customerName: record.customerName || cust.customerName || '客户',
          mobile: cust.mobile || record.mobile || '',
          schemeId: record.id,
          fileName,
        })
        setSchemeStatusMap(prev => ({ ...prev, [key]: status }))
      }

      await reportFileService.openLocalFolder(
        status.schemeDir,
        status.exists ? status.localPath : undefined
      )
    } catch (err: any) {
      message.error(`定位方案文件夹失败: ${err?.message || err}`)
    }
  }

  // 清除单份健管方案在电脑上的本地下载文件
  const handleCleanSingleScheme = async (record: HealthSchemeRecord) => {
    const cust = profileData || activeCustomer
    if (!cust) return

    setCleaningSchemeId(record.id)
    try {
      const fileName = buildHealthSchemeFileName(record)
      await reportFileService.cleanSingleSchemeFile({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: record.customerName || cust.customerName || '客户',
        mobile: cust.mobile || record.mobile || '',
        schemeId: record.id,
        fileName,
      })
      message.success('已清除该健管方案在本地电脑上的文件')
      checkSchemesStatus(schemes, cust)
    } catch (err: any) {
      message.error(`清除本地方案文件失败: ${err?.message || err}`)
    } finally {
      setCleaningSchemeId(null)
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
        message.success(`体检报告附件下载完成 (${successCount} 个文件已归档至电脑)`)
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

  // 清除单份体检报告在电脑上的本地下载文件
  const handleCleanSingleReport = async (record: MedicalReport) => {
    const cust = profileData || activeCustomer
    if (!cust) return
    const rawId = record.reportId ?? record.id
    if (!rawId) return
    const key = String(rawId)

    setCleaningReportId(rawId)
    try {
      await reportFileService.cleanSingleReportFiles({
        customerId: cust.id ?? cust.customerId ?? '',
        customerName: cust.customerName || '未命名',
        mobile: cust.mobile || '',
        reportId: rawId,
        reportDate: record.reportTime || record.uploadTime || record.createTime,
        medicalOrg: record.medicalOrg,
        fileUrls: Array.isArray(record.fileUrls) ? record.fileUrls : [],
      })
      message.success('已删除该份报告在电脑上的本地文件')
      // 刷新本地状态
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
      setReportStatusMap(prev => ({ ...prev, [key]: updatedStatus }))
    } catch (err: any) {
      message.error(`清理本地报告失败: ${err?.message || err}`)
    } finally {
      setCleaningReportId(null)
    }
  }

  // 清除当前客户名下的所有已下载本地报告文件
  const handleCleanCustomerReports = async () => {
    const cust = profileData || activeCustomer
    if (!cust) return
    setCleaningCustomerId(true)
    try {
      await reportFileService.cleanCustomerReportFiles(
        cust.customerName || '未命名',
        cust.mobile || '',
        cust.id ?? cust.customerId ?? ''
      )
      message.success('已彻底清理该客户在本地电脑上的所有档案文件（含体检报告与健管方案）')
      // 重新检查所有报告与方案状态
      if (reports.length > 0) {
        checkReportsStatus(reports, cust)
      }
      if (schemes.length > 0) {
        checkSchemesStatus(schemes, cust)
      }
    } catch (err: any) {
      message.error(`清理客户本地文件失败: ${err?.message || err}`)
    } finally {
      setCleaningCustomerId(false)
    }
  }

  // 打开体检报告安全在线预览
  const handleOpenReportPreview = (record: MedicalReport) => {
    const urls = Array.isArray(record.fileUrls) ? record.fileUrls : []
    if (urls.length === 0) {
      message.info('该报告暂无源附件文件')
      return
    }
    setSelectedReportForPreview(record)
    setReportPreviewVisible(true)
  }

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
                      历次体检报告与指标原件。支持纯内存流式安全阅览与本地智能归档，并提供一键清理磁盘文件功能
                    </Text>
                    <Space size="small" wrap>
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
                        存储与清理设置
                      </Button>
                      <Popconfirm
                        title="确定清理该客户在本地电脑上的所有报告文件？"
                        description="清理后该客户在本地电脑的报告文件将被彻底删除，随时可重新下载或在线预览。"
                        okText="确定清理"
                        cancelText="取消"
                        okButtonProps={{ danger: true, loading: cleaningCustomerId }}
                        onConfirm={handleCleanCustomerReports}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={cleaningCustomerId}
                        >
                          清理该客户文件
                        </Button>
                      </Popconfirm>
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
                        title: '附件原件',
                        key: 'fileCount',
                        width: 110,
                        render: (_: any, record: MedicalReport) => {
                          const urls = Array.isArray(record.fileUrls) ? record.fileUrls : []
                          if (urls.length === 0) {
                            return <Tag color="default">无附件</Tag>
                          }
                          const hasPdf = urls.some(u => u.toLowerCase().includes('.pdf'))
                          return (
                            <Space direction="vertical" size={2}>
                              <Tag color="geekblue">{urls.length} 份原件</Tag>
                              {hasPdf && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  含 PDF 格式
                                </Text>
                              )}
                            </Space>
                          )
                        },
                      },
                      {
                        title: '本地归档状态',
                        key: 'localStatus',
                        width: 130,
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
                        width: 235,
                        fixed: 'right' as const,
                        render: (_: any, record: MedicalReport) => {
                          const repId = record.reportId ?? record.id
                          const fileCount = Array.isArray(record.fileUrls) ? record.fileUrls.length : 0
                          const status = reportStatusMap[String(repId)]
                          const isDownloading = downloadingReportId === repId
                          const isReady = status?.allDownloaded
                          const hasLocalFiles = isReady || (status?.files?.some(f => f.exists) ?? false)

                          return (
                            <Space size={2} wrap>
                              <Button
                                type="primary"
                                size="small"
                                icon={<EyeOutlined />}
                                disabled={fileCount === 0}
                                onClick={() => handleOpenReportPreview(record)}
                              >
                                安全阅览
                              </Button>

                              {fileCount > 0 && (
                                <Tooltip title={isReady ? '重新下载所有附件至电脑' : '一键归档所有附件至本地电脑'}>
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={status?.hasUpdates ? <SyncOutlined /> : <DownloadOutlined />}
                                    loading={isDownloading}
                                    style={status?.hasUpdates ? { color: '#fa8c16' } : undefined}
                                    onClick={() => handleDownloadReport(record)}
                                  >
                                    {status?.hasUpdates ? '更新' : isReady ? '重下' : '归档'}
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

                              {hasLocalFiles && (
                                <Popconfirm
                                  title="确定删除此份报告的本地电脑文件？"
                                  description="删除后仅清除本机电脑文件，云端报告保持完好，随时可重新下载或安全在线预览。"
                                  okText="删除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => handleCleanSingleReport(record)}
                                >
                                  <Tooltip title="清除本地文件 (释放空间并符合合规要求)">
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      loading={cleaningReportId === repId}
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              )}
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
                    <Space size="small">
                      <Button
                        size="small"
                        icon={<FolderOpenOutlined />}
                        onClick={handleOpenCustomerFolder}
                      >
                        客户档案目录
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
                        icon={<ReloadOutlined />}
                        loading={schemesLoading}
                        onClick={handleRefreshSchemes}
                      >
                        刷新方案
                      </Button>
                    </Space>
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
                        title: '本地状态',
                        key: 'localStatus',
                        width: 95,
                        align: 'center',
                        render: (_: any, record: HealthSchemeRecord) => {
                          const st = schemeStatusMap[String(record.id)]
                          if (st?.exists) {
                            return (
                              <Tag color="success" icon={<CheckCircleOutlined />}>
                                已就绪
                              </Tag>
                            )
                          }
                          return <Tag color="default">未下载</Tag>
                        },
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
                        width: 235,
                        align: 'center',
                        render: (_: any, record: HealthSchemeRecord) => {
                          const isDownloading = downloadingSchemeId === record.id
                          const isRegenerating = record.async === 1
                          const st = schemeStatusMap[String(record.id)]
                          const isReady = st?.exists

                          return (
                            <Space size={2} wrap>
                              <Button
                                type="primary"
                                size="small"
                                icon={<EyeOutlined />}
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
                                disabled={isRegenerating}
                                onClick={() => {
                                  setSelectedSchemeForEdit(record)
                                  setSchemeEditVisible(true)
                                }}
                              >
                                修改
                              </Button>
                              <Tooltip title={isReady ? '重新下载方案并保存至本地电脑' : '下载方案并归档至本地客户专属目录'}>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  loading={isDownloading}
                                  onClick={() => handleDownloadSchemeRow(record)}
                                >
                                  {isReady ? '重下' : '下载发客户'}
                                </Button>
                              </Tooltip>
                              <Tooltip title="在 Windows 资源管理器中高亮定位方案文件">
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<FolderOpenOutlined />}
                                  onClick={() => handleOpenSchemeFolder(record)}
                                >
                                  定位
                                </Button>
                              </Tooltip>
                              {isReady && (
                                <Popconfirm
                                  title="确定删除此份方案的本地电脑文件？"
                                  description="删除后仅清除本机电脑文件，云端方案保持完好，随时可在线预览或重新下载。"
                                  okText="删除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => handleCleanSingleScheme(record)}
                                >
                                  <Tooltip title="清除本地文件 (释放空间并符合合规要求)">
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      loading={cleaningSchemeId === record.id}
                                    />
                                  </Tooltip>
                                </Popconfirm>
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

      {/* 体检报告在线预览弹窗（超多附件横向平滑滚动切换、防拍摄动态水印、纯内存阅览） */}
      <MedicalReportPreviewModal
        visible={reportPreviewVisible}
        report={selectedReportForPreview}
        onClose={() => {
          setReportPreviewVisible(false)
          setSelectedReportForPreview(null)
        }}
        onDownloadReport={handleDownloadReport}
        onOpenReportFolder={handleOpenReportFolder}
        isDownloading={Boolean(
          selectedReportForPreview &&
            downloadingReportId ===
              (selectedReportForPreview.reportId ?? selectedReportForPreview.id)
        )}
        isLocallyDownloaded={Boolean(
          selectedReportForPreview &&
            reportStatusMap[
              String(selectedReportForPreview.reportId ?? selectedReportForPreview.id)
            ]?.allDownloaded
        )}
      />

      {/* 存储与本地文件清理设置弹窗 */}
      <ReportStorageSettingModal
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
        onCleaned={() => {
          const cust = profileData || activeCustomer
          if (cust && reports.length > 0) {
            checkReportsStatus(reports, cust)
          }
        }}
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

      {/* 健管方案预览与下载弹窗 */}
      <HealthSchemePreviewModal
        visible={schemePreviewVisible}
        schemeRecord={selectedSchemeForPreview}
        customer={profileData || activeCustomer}
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
          const cust = profileData || activeCustomer
          if (cust) {
            checkSchemesStatus(schemes, cust)
          }
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
