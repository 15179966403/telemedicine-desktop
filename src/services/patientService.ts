import type {
  Patient,
  PatientQuery,
  PatientList,
  CustomerRecord,
  CustomerQueryParams,
  CustomerPageResult,
  ServiceRecord,
  ServiceRecordQueryParams,
  ServiceRecordPageResult,
  AppointmentRecord,
  AppointmentQueryParams,
  MedicalReport,
  AddCustomerReportParams,
  QuestionnaireRecord,
  QuestionnaireDetailResult,
  QuestionnaireQueryParams,
  QuestionnaireAnswerItem,
  HealthSchemeRecord,
  HealthSchemeQueryParams,
  HealthSchemeDetail,
} from '@/types'
import { PatientCacheService } from './patientCacheService'
import { API_BASE_URL, STORAGE_KEYS } from '@/utils/constants'
import { useAuthStore } from '@/stores/authStore'
import { StorageService } from '@/utils/storage'

const LOCAL_APPOINTMENTS_KEY = 'telemedicine_doctor_local_appointments'

export class PatientService {
  private static instance: PatientService
  private cacheService: PatientCacheService

  constructor() {
    this.cacheService = PatientCacheService.getInstance()
  }

  static getInstance(): PatientService {
    if (!PatientService.instance) {
      PatientService.instance = new PatientService()
    }
    return PatientService.instance
  }

  /**
   * 获取鉴权 Headers
   */
  private getAuthHeaders(): Record<string, string> {
    let token = ''
    if (typeof window !== 'undefined') {
      token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || ''
    }
    if (!token) {
      token = useAuthStore.getState().token || ''
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json;charset=utf-8',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * 1. 获取客户主列表（对接后台 /admin/peCustomer/pageQueryList）
   */
  async fetchCustomerList(
    params: CustomerQueryParams = { pageNum: 1, pageSize: 20 }
  ): Promise<CustomerPageResult> {
    try {
      // 过滤空值
      const payload: Record<string, any> = {}
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== undefined && value !== null) {
          payload[key] = value
        }
      }

      const res = await fetch(`${API_BASE_URL}/admin/peCustomer/pageQueryList`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          const result: CustomerPageResult = {
            code: 200,
            msg: data.msg || 'success',
            rows: data.rows || data.data || [],
            total: data.total || (data.rows ? data.rows.length : 0),
          }
          // 异步缓存
          this.cacheService.cacheCustomerList(params, result).catch(err => {
            console.warn('Cache customer list error:', err)
          })
          return result
        }
      }

      console.warn(`Customer API returned HTTP ${res.status}, using cache fallback`)
      const cached = await this.cacheService.getCachedCustomerList(params)
      if (cached) return cached
      throw new Error(`获取客户列表失败: HTTP ${res.status}`)
    } catch (error) {
      console.error('fetchCustomerList error:', error)
      const cached = await this.cacheService.getCachedCustomerList(params)
      if (cached) return cached
      throw error instanceof Error ? error : new Error('获取客户列表失败')
    }
  }

  /**
   * 2. 获取服务记录与到期提醒（对接后台 /admin/peServiceRecord/pageList）
   */
  async fetchServiceRecordList(
    params: ServiceRecordQueryParams = { pageNum: 1, pageSize: 20 }
  ): Promise<ServiceRecordPageResult> {
    try {
      const payload: Record<string, any> = {}
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== undefined && value !== null) {
          payload[key] = value
        }
      }

      // 对齐后台管理系统格式：status 在后台对应多选，必须为数组格式，如 [2], [3], [4]
      if (payload.status !== undefined && !Array.isArray(payload.status)) {
        payload.status = [payload.status]
      }

      const res = await fetch(`${API_BASE_URL}/admin/peServiceRecord/pageList`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          const rawRows: ServiceRecord[] = data.rows || data.data || []
          const result: ServiceRecordPageResult = {
            code: 200,
            msg: data.msg || 'success',
            rows: rawRows,
            total: data.total || (data.rows ? data.rows.length : 0),
          }
          this.cacheService.cacheServiceRecordList(params, result).catch(err => {
            console.warn('Cache service records error:', err)
          })
          return result
        }
      }

      console.warn(`ServiceRecord API returned HTTP ${res.status}, using cache fallback`)
      const cached = await this.cacheService.getCachedServiceRecordList(params)
      if (cached) return this.filterLocalServiceRecords(cached, params)
      throw new Error(`获取服务记录列表失败: HTTP ${res.status}`)
    } catch (error) {
      console.error('fetchServiceRecordList error:', error)
      const cached = await this.cacheService.getCachedServiceRecordList(params)
      if (cached) return this.filterLocalServiceRecords(cached, params)
      throw error instanceof Error ? error : new Error('获取服务记录失败')
    }
  }

  private filterLocalServiceRecords(
    data: ServiceRecordPageResult,
    params: ServiceRecordQueryParams
  ): ServiceRecordPageResult {
    let rows = [...data.rows]
    if (params.status !== undefined) {
      const statusArr = Array.isArray(params.status) ? params.status : [params.status]
      if (statusArr.length > 0) {
        rows = rows.filter(r => statusArr.includes(r.status))
      }
    }
    if (params.isSelect === 1) {
      rows = rows.filter(r => {
        const days = Number(r.remainingDays)
        return r.status === 3 && !isNaN(days) && days >= 0 && days <= 30
      })
    }
    if (params.userName) {
      const name = params.userName.toLowerCase()
      rows = rows.filter(r => r.userName?.toLowerCase().includes(name))
    }
    if (params.mobile) {
      rows = rows.filter(r => r.mobile?.includes(params.mobile!))
    }
    if (params.codeType !== undefined && params.codeType !== '') {
      rows = rows.filter(r => String(r.codeType) === String(params.codeType))
    }
    if (params.recordsType !== undefined && params.recordsType !== '') {
      rows = rows.filter(r => String(r.recordsType) === String(params.recordsType))
    }
    return {
      code: 200,
      rows,
      total: rows.length,
    }
  }

  /**
   * 3. 获取客户完整档案（客户基本信息 + 预约记录 + 健康标识）
   */
  async fetchCustomerProfile(params: {
    id?: string | number
    customerId?: string | number
    mobile?: string
  }): Promise<{
    customer: CustomerRecord | null
    reservations: AppointmentRecord[]
  }> {
    try {
      const queryPayload: Record<string, any> = { pageNum: 1, pageSize: 10 }
      if (params.id != null) queryPayload.id = params.id
      if (params.customerId != null) queryPayload.customerId = params.customerId
      if (params.mobile) queryPayload.mobile = params.mobile

      const [customerRes, reservationRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/admin/peCustomer/pageQueryList`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(queryPayload),
        }).then(r => r.json()),
        params.mobile
          ? fetch(`${API_BASE_URL}/admin/peReservationRecords/pageQueryList`, {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({
                mobile: params.mobile,
                pageNum: 1,
                pageSize: 50,
              }),
            }).then(r => r.json())
          : Promise.resolve({ rows: [] }),
      ])

      let customer: CustomerRecord | null = null
      if (
        customerRes.status === 'fulfilled' &&
        customerRes.value?.code === 200 &&
        customerRes.value?.rows?.length > 0
      ) {
        customer = customerRes.value.rows[0]
      }

      let reservations: AppointmentRecord[] = []
      if (
        reservationRes.status === 'fulfilled' &&
        reservationRes.value?.code === 200 &&
        reservationRes.value?.rows
      ) {
        reservations = reservationRes.value.rows
      }

      // 如果后台接口未返回且有本地缓存
      if (!customer && params.id != null) {
        customer = await this.cacheService.getCachedCustomerDetail(params.id)
      }

      return { customer, reservations }
    } catch (error) {
      console.error('fetchCustomerProfile error:', error)
      if (params.id != null) {
        const cached = await this.cacheService.getCachedCustomerDetail(params.id)
        if (cached) return { customer: cached, reservations: [] }
      }
      throw error instanceof Error ? error : new Error('获取客户详情失败')
    }
  }

  /**
   * 4. 获取客户体检报告列表（对接后台 POST /admin/peCustomer/reportPageList）
   * 参考 VIPCustomersPreView.vue 中的 reqIndicatorsReportAll
   */
  async fetchCustomerReports(customerId: string | number): Promise<MedicalReport[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/peCustomer/reportPageList`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          customerId,
          pageNum: 1,
          pageSize: 999,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          const rows: MedicalReport[] = data.rows || data.data || []
          return rows
        }
      }

      console.warn(`Report API returned HTTP ${res.status}`)
      return []
    } catch (error) {
      console.warn('fetchCustomerReports error:', error)
      return []
    }
  }

  /**
   * 5. 上传单个报告/化验单附件到后台公共文件服务（POST /common/upload）
   * 参考 admin-web dialogUploadFile.vue
   */
  async uploadReportAttachment(file: File): Promise<string> {
    try {
      let token = ''
      if (typeof window !== 'undefined') {
        token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || ''
      }
      if (!token) {
        token = useAuthStore.getState().token || ''
      }

      const formData = new FormData()
      formData.append('file', file)

      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`${API_BASE_URL}/common/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`文件服务器响应异常: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code === 200 || data.code === '200') {
        const url = data.url || data.data?.url || data.fileName
        if (url) {
          return url
        }
      }
      throw new Error(data.msg || '文件上传未返回有效地址')
    } catch (error) {
      console.error('uploadReportAttachment error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 6. 为客户手动新增/上传体检报告（POST /admin/pe/addMedical）
   * 参考 admin-web VIPCustomers/dialogUploadFile.vue 中的 reqCustomAddMedical
   */
  async addCustomerReport(payload: AddCustomerReportParams): Promise<{ code: number; msg?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/pe/addMedical`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          customerId: payload.customerId,
          fileUrls: payload.fileUrls,
          reportName: payload.reportName || '体检报告',
          reportTime: payload.reportTime,
          medicalOrg: payload.medicalOrg,
          reportType: payload.reportType ?? 1,
          templateId: payload.templateId || '',
          alias: payload.alias || payload.reportName || '体检报告',
          associatRecord: payload.associatRecord ?? 0,
        }),
      })

      if (!res.ok) {
        throw new Error(`新增报告接口响应异常: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code === 200 || data.code === '200') {
        return data
      }
      throw new Error(data.msg || '保存体检报告失败')
    } catch (error) {
      console.error('addCustomerReport error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 5. 获取服务器预约记录（/admin/peReservationRecords/pageQueryList）
   */
  async fetchReservationList(
    params: AppointmentQueryParams = { pageNum: 1, pageSize: 50 }
  ): Promise<{ rows: AppointmentRecord[]; total: number }> {
    try {
      const payload: Record<string, any> = {}
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== undefined && value !== null) {
          payload[key] = value
        }
      }

      const res = await fetch(
        `${API_BASE_URL}/admin/peReservationRecords/pageQueryList`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        }
      )

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          return {
            rows: data.rows || data.data || [],
            total: data.total || 0,
          }
        }
      }

      return { rows: [], total: 0 }
    } catch (error) {
      console.warn('fetchReservationList failed, returning empty:', error)
      return { rows: [], total: 0 }
    }
  }

  /**
   * 5. 医生本地离线日程与预约便签（替代纸质记事本）
   */
  async getLocalAppointments(): Promise<AppointmentRecord[]> {
    try {
      const list = (await StorageService.getItem(
        LOCAL_APPOINTMENTS_KEY
      )) as AppointmentRecord[]
      return list || []
    } catch (error) {
      console.error('getLocalAppointments error:', error)
      return []
    }
  }

  async saveLocalAppointment(
    record: Partial<AppointmentRecord>
  ): Promise<AppointmentRecord> {
    try {
      const existing = await this.getLocalAppointments()
      const now = new Date().toISOString()
      const rawId = record.id != null ? record.id : `local_${Date.now()}`

      const newRecord: AppointmentRecord = {
        userName: record.userName || '客户',
        mobile: record.mobile || '',
        reservationDate:
          record.reservationDate || now.split('T')[0],
        startTime: record.startTime || '09:00',
        endTime: record.endTime || '09:30',
        reservationType: record.reservationType || 3,
        reservationTypeName: record.reservationTypeName || '随访复查',
        status: record.status ?? 0,
        doctorName: record.doctorName || '当前医生',
        remarks: record.remarks || '',
        isLocal: true,
        syncStatus: 'local_only',
        createdAt: record.createdAt || now,
        updatedAt: now,
        id: rawId,
        customerId: record.customerId,
      }

      const index = existing.findIndex(item => item.id === newRecord.id)
      let updated: AppointmentRecord[]
      if (index >= 0) {
        updated = existing.map((item, idx) =>
          idx === index ? { ...item, ...newRecord } : item
        )
      } else {
        updated = [newRecord, ...existing]
      }

      await StorageService.setItem(LOCAL_APPOINTMENTS_KEY, updated)
      return newRecord
    } catch (error) {
      console.error('saveLocalAppointment error:', error)
      throw new Error('保存本地随访预约失败')
    }
  }

  async deleteLocalAppointment(id: string | number): Promise<void> {
    try {
      const existing = await this.getLocalAppointments()
      const filtered = existing.filter(item => item.id !== id)
      await StorageService.setItem(LOCAL_APPOINTMENTS_KEY, filtered)
    } catch (error) {
      console.error('deleteLocalAppointment error:', error)
      throw new Error('删除本地预约失败')
    }
  }

  /**
   * 6. 合并获取预约日历数据（远程接口 + 本地离线便签）
   */
  async getCombinedAppointments(
    params: AppointmentQueryParams = { pageNum: 1, pageSize: 100 }
  ): Promise<{ rows: AppointmentRecord[]; total: number }> {
    try {
      const [remoteRes, localList] = await Promise.all([
        this.fetchReservationList(params),
        this.getLocalAppointments(),
      ])

      // 过滤本地列表中符合当前日期条件的记录
      let filteredLocal = localList
      if (params.reservationDate) {
        filteredLocal = localList.filter(
          item => item.reservationDate === params.reservationDate
        )
      }

      // 合并排重
      const combined = [...filteredLocal, ...remoteRes.rows]
      return {
        rows: combined,
        total: combined.length,
      }
    } catch (error) {
      console.error('getCombinedAppointments error:', error)
      const localList = await this.getLocalAppointments()
      return { rows: localList, total: localList.length }
    }
  }

  /**
   * 兼容旧接口：getPatientList
   */
  async getPatientList(query: PatientQuery = { page: 1, pageSize: 20 }): Promise<PatientList> {
    try {
      const res = await this.fetchCustomerList({
        pageNum: query.page,
        pageSize: query.pageSize,
        customerName: query.keyword,
      })

      const patients: Patient[] = res.rows.map(item => ({
        id: item.id,
        customerId: item.customerId,
        name: item.customerName,
        age: Number(item.age) || 0,
        gender: item.gender === 1 || item.gender === '1' ? 'male' : 'female',
        phone: item.mobile,
        idCard: item.idCardNo,
        tags: [
          ...(item.abTag ? item.abTag.split(',') : []),
          ...(item.chTag ? item.chTag.split(',') : []),
        ].filter(Boolean),
        vipName: item.vipName,
        companyName: item.companyName,
        subCompanyName: item.subCompanyName,
        ownerPhysicianName: item.ownerPhysicianName,
        ownerCsName: item.ownerCsName,
        medicalHistory: [],
        createdAt: item.createTime ? new Date(item.createTime) : new Date(),
        updatedAt: item.updateTime ? new Date(item.updateTime) : new Date(),
      }))

      return {
        patients,
        total: res.total,
        page: query.page,
        pageSize: query.pageSize,
      }
    } catch (error) {
      console.warn('getPatientList fallback to cache:', error)
      const cached = await this.cacheService.getCachedPatientList(query)
      if (cached) return cached
      return { patients: [], total: 0, page: 1, pageSize: 20 }
    }
  }

  async getPatientDetail(patientId: string | number): Promise<Patient> {
    try {
      const { customer } = await this.fetchCustomerProfile({ id: patientId })
      if (!customer) {
        throw new Error('未找到患者档案')
      }
      return {
        id: customer.id,
        customerId: customer.customerId,
        name: customer.customerName,
        age: Number(customer.age) || 0,
        gender: customer.gender === 1 || customer.gender === '1' ? 'male' : 'female',
        phone: customer.mobile,
        idCard: customer.idCardNo,
        tags: [
          ...(customer.abTag ? customer.abTag.split(',') : []),
          ...(customer.chTag ? customer.chTag.split(',') : []),
        ].filter(Boolean),
        vipName: customer.vipName,
        companyName: customer.companyName,
        subCompanyName: customer.subCompanyName,
        ownerPhysicianName: customer.ownerPhysicianName,
        ownerCsName: customer.ownerCsName,
        medicalHistory: [],
        createdAt: customer.createTime ? new Date(customer.createTime) : new Date(),
        updatedAt: customer.updateTime ? new Date(customer.updateTime) : new Date(),
      }
    } catch (error) {
      console.error('getPatientDetail failed:', error)
      throw error
    }
  }

  async updatePatientTags(patientId: string | number, tags: string[]): Promise<void> {
    await this.cacheService.updatePatientCache(patientId, { tags })
  }

  async searchPatients(keyword: string): Promise<Patient[]> {
    const res = await this.getPatientList({
      page: 1,
      pageSize: 20,
      keyword,
    })
    return res.patients
  }

  /**
   * 7. 获取客户健康生活问卷列表 (POST /admin/peQuestionnaireInfo/pageQueryList)
   * 参考 admin-web SatisfactionSurvey/QuestionnaireAnswer.vue
   */
  async fetchCustomerQuestionnaires(
    params: QuestionnaireQueryParams
  ): Promise<{ rows: QuestionnaireRecord[]; total: number }> {
    try {
      const payload: Record<string, any> = {
        pageNum: params.pageNum || 1,
        pageSize: params.pageSize || 50,
      }
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== undefined && value !== null) {
          payload[key] = value
        }
      }

      const res = await fetch(`${API_BASE_URL}/admin/peQuestionnaireInfo/pageQueryList`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          const rows: QuestionnaireRecord[] = data.rows || data.data || []
          const total: number = data.total || (data.rows ? data.rows.length : 0)
          return { rows, total }
        }
      }

      console.warn(`Questionnaire list API returned HTTP ${res.status}`)
      return { rows: [], total: 0 }
    } catch (error) {
      console.warn('fetchCustomerQuestionnaires error:', error)
      return { rows: [], total: 0 }
    }
  }

  /**
   * 8. 获取问卷答题详情 (POST /admin/peQuestionnaireInfo/details)
   * 参考 admin-web dialogHealthReportPreView.vue
   */
  async fetchQuestionnaireDetail(id: string | number): Promise<QuestionnaireDetailResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/peQuestionnaireInfo/details`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        throw new Error(`获取问卷详情失败: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code !== 200 && data.code !== undefined && data.code !== '200') {
        throw new Error(data.msg || '获取问卷详情失败')
      }

      const rawData = data.data || data
      const answerList = rawData.lineDetailsVos || []

      // 题目合并逻辑：按照 questionnaireTitleId 分组，非简答题合并各选项
      const answerMap = new Map<string | number, any>()
      answerList.forEach((item: any) => {
        const key = item.questionnaireTitleId ?? item.id
        if (item.questionType == 3) {
          // 简答题直接作为一条
          answerMap.set(key, { ...item })
        } else {
          const existing = answerMap.get(key)
          const firstAnswer = item.answerResponseVos?.[0]
          let answerLabel = firstAnswer?.answerLabel || ''
          if (item.questionAnswer) {
            answerLabel = answerLabel ? `${answerLabel}-${item.questionAnswer}` : item.questionAnswer
          }

          if (existing) {
            if (existing.answerResponseVos) {
              existing.answerResponseVos.push({ ...firstAnswer, answerLabel })
            }
          } else {
            const copy = {
              ...item,
              answerResponseVos: firstAnswer ? [{ ...firstAnswer, answerLabel }] : [],
            }
            answerMap.set(key, copy)
          }
        }
      })

      const formattedList: QuestionnaireAnswerItem[] = Array.from(answerMap.values()).map((item: any) => {
        let questionAnswer = item.questionAnswer || ''
        if (item.questionType != 3 && item.answerResponseVos?.length) {
          questionAnswer = item.answerResponseVos
            .map((c: any) => c.answerLabel)
            .filter(Boolean)
            .join('，')
        }
        return {
          id: item.id,
          questionnaireTitleId: item.questionnaireTitleId,
          questionName: item.titleResponseVo?.questionName || item.questionName || '未命名问题',
          questionAnswer: questionAnswer || '未作答',
          questionType: item.questionType,
        }
      })

      const detail: QuestionnaireDetailResult = {
        ...rawData,
        id: rawData.id ?? id,
        answerList: formattedList,
      }
      return detail
    } catch (error) {
      console.error('fetchQuestionnaireDetail error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 9. 导出问卷 Excel / 报告 (POST /admin/peQuestionnaireInfo/export)
   * 参考 admin-web handleExportRow
   */
  async exportQuestionnaireExcel(id: string | number, defaultFileName?: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/peQuestionnaireInfo/export`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id,
          questionCode: 'customerSatisfactionSurvey',
        }),
      })

      if (!res.ok) {
        throw new Error(`导出接口异常: HTTP ${res.status}`)
      }

      // 解析文件名
      const contentDisposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition')
      let fileName = defaultFileName || `健康生活问卷_${id}.xlsx`
      if (contentDisposition) {
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
        if (utf8Match && utf8Match[1]) {
          fileName = decodeURIComponent(utf8Match[1])
        } else {
          const match = contentDisposition.match(/filename="?([^";]+)"?/i)
          if (match && match[1]) {
            fileName = decodeURIComponent(match[1])
          }
        }
      }

      const blob = await res.blob()
      const urlBlob = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = urlBlob
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(urlBlob)
    } catch (error) {
      console.error('exportQuestionnaireExcel error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 10. 获取三师健管方案列表 (POST /admin/customerHealthSchemeRecord/pageQueryList)
   * 参考 admin-web reportScenariosList.vue
   */
  async fetchHealthSchemeList(
    params: HealthSchemeQueryParams
  ): Promise<{ rows: HealthSchemeRecord[]; total: number }> {
    try {
      const payload: Record<string, any> = {
        pageNum: params.pageNum || 1,
        pageSize: params.pageSize || 20,
      }
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== undefined && value !== null) {
          payload[key] = value
        }
      }

      const res = await fetch(`${API_BASE_URL}/admin/customerHealthSchemeRecord/pageQueryList`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 || data.code === undefined) {
          const rows: HealthSchemeRecord[] = data.rows || data.data || []
          const total: number = data.total || (data.rows ? data.rows.length : 0)
          return { rows, total }
        }
      }

      console.warn(`Health scheme list API returned HTTP ${res.status}`)
      return { rows: [], total: 0 }
    } catch (error) {
      console.warn('fetchHealthSchemeList error:', error)
      return { rows: [], total: 0 }
    }
  }

  /**
   * 11. 查询管理方案编辑详情内容 (POST /admin/customerHealthSchemeInfo/detail)
   * 参考 admin-web reqCustomerHealthSchemeRecordDetail
   */
  async fetchHealthSchemeDetail(healthSchemeRecordId: string | number): Promise<HealthSchemeDetail> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/customerHealthSchemeInfo/detail`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ healthSchemeRecordId }),
      })

      if (!res.ok) {
        throw new Error(`获取方案详情接口异常: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code === 200 && data.data) {
        return data.data
      }
      if (data.data) {
        return data.data
      }
      throw new Error(data.msg || '获取健管方案详情失败')
    } catch (error) {
      console.error('fetchHealthSchemeDetail error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 12. 提交管理方案修改并重新生成 (POST /admin/customerHealthSchemeRecord/updateHealthSchemeRecord)
   * 参考 admin-web reqCustomerHealthSchemeRecordUpdate
   */
  async updateHealthSchemeRecord(payload: HealthSchemeDetail): Promise<{ code: number; msg?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/customerHealthSchemeRecord/updateHealthSchemeRecord`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`更新方案接口异常: HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.code === 200 || data.code === '200') {
        return data
      }
      throw new Error(data.msg || '更新健管方案失败')
    } catch (error) {
      console.error('updateHealthSchemeRecord error:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  /**
   * 13. 记录方案下载次数 (GET /admin/customerHealthSchemeRecord/updateDownload/{id})
   * 参考 admin-web reqAdminSchemeDownloadCount
   */
  async recordHealthSchemeDownload(id: string | number): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/admin/customerHealthSchemeRecord/updateDownload/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })
    } catch (error) {
      console.warn('recordHealthSchemeDownload error:', error)
    }
  }

  /**
   * 14. 获取医生/角色人员列表 (POST /system/user/listWithRoleKey)
   * 用于在修改健管方案时指定审核医师
   */
  async fetchStaffByRole(roleKey: string = '医师'): Promise<Array<{ value: string | number; label: string }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/system/user/listWithRoleKey`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ tenantId: 0, roleKey }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.code === 200 && Array.isArray(data.rows || data.data)) {
          const list = data.rows || data.data
          return list.map((item: any) => ({
            value: item.userId ?? item.id,
            label: item.trueName || item.nickName || item.userName || '未知人员',
          }))
        }
      }
      return []
    } catch (err) {
      console.warn(`fetchStaffByRole [${roleKey}] failed:`, err)
      return []
    }
  }
}
