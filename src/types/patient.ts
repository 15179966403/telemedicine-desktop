/**
 * 患者管理相关类型定义
 * Patient management related type definitions
 */

// 患者基本信息
export interface Patient {
  id: string
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
}

// 病历记录
export interface MedicalRecord {
  id: string
  patientId: string
  consultationId: string
  diagnosis: string
  symptoms: string[]
  prescription: Prescription[]
  examinations: Examination[]
  doctorId: string
  doctorName: string
  createdAt: Date
}

// 处方信息
export interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

// 检查报告
export interface Examination {
  id: string
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
  id: string
  type: 'text' | 'video' | 'phone'
  status: 'active' | 'completed' | 'cancelled'
  diagnosis?: string
  createdAt: Date
  completedAt?: Date
}

// 随访提醒
export interface FollowUpReminder {
  id: string
  patientId: string
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

// 患者服务接口
export interface PatientService {
  getPatientList(query: PatientQuery): Promise<PatientList>
  getPatientDetail(patientId: string): Promise<PatientDetail>
  updatePatientTags(patientId: string, tags: string[]): Promise<void>
  searchPatients(keyword: string): Promise<Patient[]>
  addFollowUpReminder(
    patientId: string,
    reminder: Omit<FollowUpReminder, 'id' | 'patientId'>
  ): Promise<void>
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
