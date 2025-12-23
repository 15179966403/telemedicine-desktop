// 应用常量定义

// API 相关
export const API_BASE_URL = 'https://api.telemedicine.com'
export const WS_BASE_URL = 'wss://ws.telemedicine.com'

// 本地存储键名
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  THEME: 'theme',
  WINDOW_STATE: 'window_state',
  PATIENT_CACHE: 'patient_cache',
  MESSAGE_CACHE: 'message_cache',
} as const

// 窗口配置
export const WINDOW_CONFIG = {
  MAX_WINDOWS: 5,
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 600,
  MIN_WIDTH: 600,
  MIN_HEIGHT: 400,
} as const

// 文件上传配置
export const FILE_CONFIG = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for upload
} as const

// 消息配置
export const MESSAGE_CONFIG = {
  MAX_MESSAGE_LENGTH: 5000,
  HISTORY_PAGE_SIZE: 20,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const

// 患者管理配置
export const PATIENT_CONFIG = {
  PAGE_SIZE: 20,
  MAX_TAGS: 10,
  SEARCH_DEBOUNCE: 300,
} as const

// 认证配置
export const AUTH_CONFIG = {
  TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5分钟
  SESSION_CHECK_INTERVAL: 60 * 1000, // 1分钟
  AUTO_LOGOUT_TIME: 8 * 60 * 60 * 1000, // 8小时
} as const

// 错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

// 消息类型
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  FILE: 'file',
} as const

// 用户角色
export const USER_ROLES = {
  DOCTOR: 'doctor',
  ADMIN: 'admin',
} as const

// 问诊状态
export const CONSULTATION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

// 消息状态
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const

// 主题
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const

// 通知类型
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const

// 窗口类型
export const WINDOW_TYPES = {
  MAIN: 'main',
  CONSULTATION: 'consultation',
  PATIENT: 'patient',
  SETTINGS: 'settings',
} as const