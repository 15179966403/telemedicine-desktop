// 基础类型定义
export interface User {
  id: string
  username: string
  name: string
  role: 'doctor' | 'admin'
  avatar?: string
  department?: string
  title?: string
}

export interface Patient {
  id: string
  name: string
  age: number
  gender: 'male' | 'female'
  phone: string
  tags: string[]
  lastVisit: Date
  medicalHistory: MedicalRecord[]
}

export interface MedicalRecord {
  id: string
  patientId: string
  doctorId: string
  diagnosis: string
  treatment: string
  createdAt: Date
}

export interface Message {
  id: string
  consultationId: string
  type: 'text' | 'image' | 'voice' | 'file'
  content: string
  sender: 'doctor' | 'patient'
  timestamp: Date
  status: 'sending' | 'sent' | 'delivered' | 'failed'
  filePath?: string
}

export interface Consultation {
  id: string
  patientId: string
  doctorId: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  type: 'text' | 'video' | 'voice'
  createdAt: Date
  updatedAt: Date
}

export interface WindowInfo {
  id: string
  type: 'main' | 'consultation' | 'patient' | 'settings'
  title: string
  data?: any
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: number
}

// 认证相关类型
export interface LoginCredentials {
  type: 'password' | 'sms' | 'realname'
  username?: string
  password?: string
  phone?: string
  smsCode?: string
  idCard?: string
}

export interface AuthResult {
  token: string
  user: User
  expiresAt: Date
}

// 错误类型
export interface AppError {
  type:
    | 'NETWORK_ERROR'
    | 'AUTH_ERROR'
    | 'DATA_ERROR'
    | 'SYSTEM_ERROR'
    | 'UNKNOWN_ERROR'
  message: string
  code?: string
  retryable?: boolean
  retryCount?: number
  retry?: () => void
}
