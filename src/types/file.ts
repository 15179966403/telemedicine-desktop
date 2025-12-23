/**
 * 文件管理相关类型定义
 * File management type definitions
 */

// 文件信息
export interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  url: string
  localPath?: string
  uploadedAt: Date
  checksum?: string
  mimeType?: string
}

// 文件上传进度
export interface FileUploadProgress {
  fileId: string
  fileName: string
  loaded: number
  total: number
  percentage: number
  status: 'uploading' | 'completed' | 'failed' | 'cancelled'
}

// 文件缓存信息
export interface FileCacheInfo {
  id: string
  fileUrl: string
  localPath: string
  fileSize?: number
  mimeType?: string
  checksum?: string
  expiresAt?: Date
  downloadedAt: Date
  lastAccessed: Date
}

// 文件验证规则
export interface FileValidationRules {
  maxSize: number // bytes
  allowedTypes: string[]
  allowedExtensions: string[]
  maxFiles?: number
}

// 文件操作结果
export interface FileOperationResult {
  success: boolean
  fileInfo?: FileInfo
  error?: string
  localPath?: string
}

// 文件预览信息
export interface FilePreviewInfo {
  id: string
  name: string
  type: string
  url: string
  previewUrl?: string
  thumbnailUrl?: string
  canPreview: boolean
}

// 文件存储配置
export interface FileStorageConfig {
  localStoragePath: string
  maxCacheSize: number // bytes
  cacheExpiration: number // milliseconds
  cleanupInterval: number // milliseconds
  compressionEnabled: boolean
  encryptionEnabled: boolean
}

// 文件清理策略
export interface FileCacheCleanupStrategy {
  maxAge: number // milliseconds
  maxSize: number // bytes
  maxFiles: number
  cleanupOnStartup: boolean
  cleanupInterval: number // milliseconds
}

// 文件安全检查结果
export interface FileSecurityCheckResult {
  safe: boolean
  threats: string[]
  warnings: string[]
  blocked: boolean
  reason?: string
}

// 文件压缩选项
export interface FileCompressionOptions {
  enabled: boolean
  quality: number // 0-100
  maxWidth?: number
  maxHeight?: number
  format?: 'jpeg' | 'png' | 'webp'
}

// 文件上传配置
export interface FileUploadConfig {
  maxFileSize: number // bytes
  maxFiles: number
  allowedTypes: string[]
  chunkSize?: number // bytes for chunked upload
  retryAttempts: number
  timeout: number // milliseconds
  compression?: FileCompressionOptions
}

// 文件下载配置
export interface FileDownloadConfig {
  timeout: number // milliseconds
  retryAttempts: number
  chunkSize?: number // bytes
  resumeSupport: boolean
}

// 文件同步状态
export type FileSyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'

// 文件同步信息
export interface FileSyncInfo {
  fileId: string
  status: FileSyncStatus
  lastSyncAt?: Date
  syncAttempts: number
  error?: string
}

// 文件统计信息
export interface FileStatistics {
  totalFiles: number
  totalSize: number
  cacheHitRate: number
  uploadSuccessRate: number
  downloadSuccessRate: number
  averageUploadTime: number
  averageDownloadTime: number
}
