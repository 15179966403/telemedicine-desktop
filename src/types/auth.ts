/**
 * 认证相关类型定义
 * Authentication related type definitions
 */

// 登录凭证类型
export interface LoginCredentials {
  type: 'password' | 'sms' | 'realname'
  username?: string
  password?: string
  phone?: string
  smsCode?: string
  idCard?: string
}

// 认证结果
export interface AuthResult {
  success: boolean
  token?: string
  user?: User
  message?: string
  requiresRealname?: boolean
  auditStatus?: AuditStatus
}

// 用户信息
export interface User {
  id: string
  username: string
  name: string
  phone: string
  email?: string
  avatar?: string
  department: string
  title: string
  licenseNumber: string
  auditStatus: AuditStatus
  createdAt: Date
  lastLogin?: Date
}

// 审核状态
export type AuditStatus = 'pending' | 'approved' | 'rejected' | 'incomplete'

// 会话信息
export interface Session {
  token: string
  refreshToken: string
  expiresAt: Date
  userId: string
}

// 认证服务接口
export interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthResult>
  logout(): Promise<void>
  refreshToken(): Promise<string>
  validateSession(): Promise<boolean>
  getRealNameStatus(): Promise<AuditStatus>
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  sessionExpires: Date | null
  auditStatus: AuditStatus
  loading: boolean
  error: string | null
}
