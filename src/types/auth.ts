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
  code?: string
  uuid?: string
  rememberMe?: boolean
}

// 验证码结果
export interface CaptchaResult {
  code?: number
  msg?: string
  img: string
  uuid: string
}

// 认证结果
export interface AuthResult {
  success?: boolean
  token?: string
  user?: User
  message?: string
  requiresRealname?: boolean
  auditStatus?: AuditStatus
  expiresAt?: Date
}

// 用户信息
// 遵循项目规范：所有名为 id 或符合 xxxxId 形式的字段，保持其原始格式，不得进行格式转换
export interface User {
  id: string | number
  userId?: string | number
  tenantId?: string | number
  deptId?: string | number
  username: string
  name: string
  trueName?: string
  phone: string
  phonenumber?: string
  email?: string
  avatar?: string
  department: string
  title: string
  licenseNumber?: string
  roles?: string[]
  permissions?: string[]
  auditStatus?: AuditStatus
  createdAt?: Date
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
