/**
 * 通用类型定义
 * Common type definitions
 */

// API 响应基础结构
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  code?: string
  timestamp: Date
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 错误类型
export interface AppError {
  type: ErrorType
  message: string
  code?: string
  details?: any
  retryable?: boolean
  retryCount?: number
  timestamp: Date
}

// 错误类型枚举
export type ErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'DATA_ERROR'
  | 'SYSTEM_ERROR'
  | 'UNKNOWN_ERROR'

// 网络错误
export interface NetworkError extends AppError {
  type: 'NETWORK_ERROR'
  statusCode?: number
  retry?: () => Promise<void>
}

// 验证错误
export interface ValidationError extends AppError {
  type: 'VALIDATION_ERROR'
  field?: string
  violations: ValidationViolation[]
}

// 验证违规
export interface ValidationViolation {
  field: string
  message: string
  code: string
}

// 加载状态
export interface LoadingState {
  loading: boolean
  error: string | null
}

// 操作结果
export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: AppError
}

// 文件上传进度
export interface UploadProgress {
  fileId: string
  fileName: string
  loaded: number
  total: number
  percentage: number
  status: 'uploading' | 'completed' | 'failed' | 'cancelled'
}

// 同步状态
export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'

// 缓存项
export interface CacheItem<T> {
  key: string
  data: T
  timestamp: Date
  expiresAt?: Date
  version: number
}

// 配置项
export interface AppConfig {
  apiBaseUrl: string
  wsUrl: string
  maxFileSize: number // bytes
  allowedFileTypes: string[]
  cacheExpiration: number // milliseconds
  retryAttempts: number
  retryDelay: number // milliseconds
  windowLimits: {
    maxWindows: number
    maxConsultationWindows: number
  }
}

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志条目
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: Record<string, any>
  error?: Error
}

// 通知类型
export type NotificationType = 'info' | 'success' | 'warning' | 'error'

// 通知消息
export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
  actions?: NotificationAction[]
  timestamp: Date
}

// 通知操作
export interface NotificationAction {
  label: string
  action: () => void
  primary?: boolean
}

// 键值对
export interface KeyValuePair<T = string> {
  key: string
  value: T
}

// 选项项
export interface Option<T = string> {
  label: string
  value: T
  disabled?: boolean
}

// 排序参数
export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

// 搜索参数
export interface SearchParams {
  keyword: string
  fields?: string[]
  exact?: boolean
}

// 时间范围
export interface DateRange {
  start: Date
  end: Date
}

// 统计数据
export interface Statistics {
  [key: string]: number | string | Date
}
