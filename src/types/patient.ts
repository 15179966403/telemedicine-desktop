/**
 * 患者管理相关类型定义
 * Patient management related type definitions
 *
 * 遵循项目约束：
 * 所有名为 id 或符合 xxxxId 形式的字段，保持其原始格式；不得通过自动添加的方法对这些字段进行格式转换。
 */

// 客户主数据（对接后台 /admin/peCustomer/pageQueryList）
export interface CustomerRecord {
  id: string | number
  customerId?: string | number
  customerName: string
  mobile: string
  gender?: number | string // 1: 男, 2: 女
  age?: number | string
  idCardNo?: string
  customerType?: number | string // 1: 营销条线, 2: 银保条线, 3: 收展条线, 4: 其他
  roleType?: number | string // 1: 医师, 2: 健管师, 3: 营养师
  vipName?: string
  bankLabel?: string // 客户标识 (如金穗卡、浦发卡等)
  recordsType?: number | string // 记录类型，0: 三好卡, 2: 金穗卡, 6: 联好金卡, 7: 企微
  abTag?: string // 指标异常标签 (逗号分隔)
  diTag?: string // 大病标签 (逗号分隔)
  chTag?: string // 慢病标签 (逗号分隔)
  topCompanyName?: string
  companyName?: string
  subCompanyName?: string
  ownerPhysician?: string | number
  ownerPhysicianName?: string
  ownerCs?: string | number
  ownerCsName?: string
  ownerNurse?: string | number
  ownerNurseName?: string
  ownerDietitian?: string | number
  ownerDietitianName?: string
  hasReport?: number // 0: 未上传, 1: 已上传
  createTime?: string
  updateTime?: string
  allergyHistory?: string
  pastHistory?: string
  familyHistory?: string
  [key: string]: any
}

// 客户查询参数
export interface CustomerQueryParams {
  pageNum: number
  pageSize: number
  customerName?: string
  mobile?: string
  gender?: number | string
  topCompanyName?: string
  companyName?: string
  subCompanyName?: string
  customerType?: number | string
  abTag?: string
  diTag?: string
  chTag?: string
  ownerPhysician?: string | number
  hasReport?: number
  createTimeBegin?: string
  createTimeEnd?: string
}

// 客户分页响应
export interface CustomerPageResult {
  code: number
  msg?: string
  rows: CustomerRecord[]
  total: number
}

// 服务记录与到期提醒（对接后台 /admin/peServiceRecord/pageList）
export interface ServiceRecord {
  id: string | number
  customerId?: string | number
  recordsNumber?: string
  vipCode?: string
  vipUuid?: string
  userName: string
  mobile: string
  gender?: number | string
  age?: number | string
  bankLabel?: string // 客户标识 (如金穗卡、浦发卡等)
  recordsType?: number | string // 记录类型，0: 三好卡, 2: 金穗卡, 6: 联好金卡, 7: 企微
  codeType?: number | string // 服务类型代码，对应字典 service_type
  codeTypeName?: string
  status: number // 2: 待服务, 3: 服务中, 4: 服务结束
  remainingDays?: number | string // 剩余天数
  serviceStartTime?: string
  serviceEndTime?: string
  itemCode?: string | number
  itemCodeName?: string
  testProjectName?: string
  groupChatName?: string // 企微/微信群名
  interestsName?: string // 权益名称
  codeStatus?: number // 健康服务状态: 1 待兑换, 2/3/4 已兑换, 99 已过期
  thirdCodeStatus?: number // 绿通服务状态: 1 待兑换, 2 已兑换, 99 已过期
  indicatorsNum?: number | string // 指标项数量
  activationNum?: number | string // 激活卡数
  ownerPhysician?: string | number
  ownerPhysicianName?: string
  ownerDietitian?: string | number
  ownerDietitianName?: string
  ownerHealth?: string | number
  ownerHealthName?: string
  topCompanyName?: string
  companyName?: string
  subCompanyName?: string
  generateStatus?: number // 健管方案生成状态: 0 未生成, 1/2 已生成
  haveRead?: number // 服务清单是否已读: 0 未读, 1 已读
  joinGroupFlag?: number // 1: 已建联, 0: 未建联
  joinGroupTime?: string
  exitGroupReason?: string
  customerAddress?: string
  sureAddress?: number // 1: 已确认, 0: 未确认
  memo?: string
  tagsName?: string[] | string
  sysTag?: string
  activationTime?: string
  recommender?: string
  ships?: Array<{
    orderSn?: string
    spCode?: string
    receiverAddress?: string
    [key: string]: any
  }>
  [key: string]: any
}

// 服务记录查询参数
export interface ServiceRecordQueryParams {
  pageNum: number
  pageSize: number
  userName?: string
  mobile?: string
  status?: number | number[]
  ownerPhysician?: string | number
  remainingDays?: number | string
  codeType?: string | number // 服务类型
  recordsType?: string | number // 客户标识
  itemCode?: string | number
  companyFlag?: number
  vipCode?: string
  joinGroupFlag?: number
  generateStatus?: number
  haveRead?: number
  isSelect?: number
}

// 服务记录分页响应
export interface ServiceRecordPageResult {
  code: number
  msg?: string
  rows: ServiceRecord[]
  total: number
}

// 预约及日程记录（对接后台 /admin/peReservationRecords/pageQueryList + 本地日历日程）
export interface AppointmentRecord {
  id: string | number
  reservationId?: string | number
  customerId?: string | number
  userName: string
  mobile: string
  gender?: number | string
  age?: number | string
  reservationDate: string // YYYY-MM-DD
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  reservationType?: string | number // 1: 体检, 2: 报告解读, 3: 专属随访, etc.
  reservationTypeName?: string
  status?: number // 0: 预约中, 1: 已完成, 2: 已取消
  doctorName?: string
  ownerPhysicianId?: string | number
  remarks?: string
  isLocal?: boolean // 是否为医生本地离线日程便签
  syncStatus?: 'synced' | 'local_only' | 'pending'
  createdAt?: string | Date
  updatedAt?: string | Date
  [key: string]: any
}

// 预约查询参数
export interface AppointmentQueryParams {
  pageNum?: number
  pageSize?: number
  reservationDate?: string
  startTime?: string
  endTime?: string
  mobile?: string
  userName?: string
  reservationType?: string | number
  status?: number
}

// 患者基本信息（兼顾既有前端页面使用）
export interface Patient {
  id: string | number
  customerId?: string | number
  name: string
  age: number
  gender: 'male' | 'female'
  phone: string
  idCard?: string
  avatar?: string
  tags: string[]
  lastVisit?: Date
  medicalHistory: MedicalRecord[]
  createdAt: Date
  updatedAt: Date
  // 扩展属性
  vipName?: string
  companyName?: string
  subCompanyName?: string
  ownerPhysicianName?: string
  ownerCsName?: string
  serviceStatus?: number
  remainingDays?: number
}

// 病历记录
export interface MedicalRecord {
  id: string | number
  patientId: string | number
  consultationId: string | number
  diagnosis: string
  symptoms: string[]
  prescription: Prescription[]
  examinations: Examination[]
  doctorId: string | number
  doctorName: string
  createdAt: Date
}

// 处方信息
export interface Prescription {
  id: string | number
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

// 检查报告
export interface Examination {
  id: string | number
  type: string
  name: string
  result: string
  fileUrl?: string
  reportDate: Date
}

// 患者查询参数
export interface PatientQuery {
  keyword?: string
  tags?: string[]
  gender?: 'male' | 'female'
  ageRange?: {
    min: number
    max: number
  }
  lastVisitRange?: {
    start: Date
    end: Date
  }
  page: number
  pageSize: number
}

// 患者列表响应
export interface PatientList {
  patients: Patient[]
  total: number
  page: number
  pageSize: number
}

// 患者详情
export interface PatientDetail extends Patient {
  consultationHistory: ConsultationSummary[]
  followUpReminders: FollowUpReminder[]
}

// 问诊摘要
export interface ConsultationSummary {
  id: string | number
  type: 'text' | 'video' | 'phone'
  status: 'active' | 'completed' | 'cancelled'
  diagnosis?: string
  createdAt: Date
  completedAt?: Date
}

// 随访提醒
export interface FollowUpReminder {
  id: string | number
  patientId: string | number
  type: 'checkup' | 'medication' | 'lifestyle'
  message: string
  scheduledAt: Date
  completed: boolean
}

// 患者筛选条件
export interface PatientFilters {
  tags: string[]
  gender?: 'male' | 'female'
  ageRange?: {
    min: number
    max: number
  }
  hasRecentVisit: boolean
}

// 患者状态管理
export interface PatientState {
  patients: Patient[]
  selectedPatient: Patient | null
  patientDetail: PatientDetail | null
  searchQuery: string
  filters: PatientFilters
  loading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

// 客户体检报告 (参考后台 /admin/peCustomer/reportPageList)
export interface MedicalReport {
  id?: string | number
  reportId?: string | number
  customerId?: string | number
  reportType?: number | string // 1: 体检报告, 2: 理化指标, 3: 免回复无就医记录, -1: 未知
  reportTime?: string // 体检日期
  medicalOrg?: string // 体检机构
  uploadTime?: string // 上传时间
  fileUrls?: string[] // 报告附件列表（图片或 PDF URL）
  orcStatus?: number // OCR识别状态: 0 未开始, 1 识别中, 2 完成, 3 失败
  clinicalEvaluation?: string // 报告诊评意见
  anyiHealth?: boolean // 是否为安颐健康
  [key: string]: any
}
