// 认证相关类型
export * from './auth'

// 患者管理相关类型
export * from './patient'

// 消息通信相关类型
export * from './message'

// 窗口管理相关类型
export * from './window'

// 文件管理相关类型 (排除重复的 FileInfo)
export type {
  FileUploadProgress,
  FileCacheInfo,
  FileValidationRules,
  FileOperationResult,
  FilePreviewInfo,
} from './file'

// 安全相关类型
export * from './security'

// 通用类型
export * from './common'

// AI 智能体类型
export * from './ai'

// 客户随访便签（医生本地标记）类型
export * from './memo'

