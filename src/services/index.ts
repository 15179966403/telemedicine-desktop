// 服务层导出
export { AuthService } from './authService'
export { PatientService } from './patientService'
export { MessageService } from './messageService'
export { FileService } from './fileService'
export { WindowService } from './windowService'

// 问诊服务
export { ConsultationService, consultationService } from './consultationService'

// WebSocket 实时通信服务
export { WebSocketService, webSocketService } from './webSocketService'
export type { WebSocketConfig } from './webSocketService'

// 文件管理服务
export { FileStorageService } from './fileStorageService'
export { FileValidationService } from './fileValidationService'
export { FileCacheService } from './fileCacheService'

// 窗口间通信服务
export * from './windowCommunication'

// 窗口状态持久化服务
export * from './windowPersistence'

// 窗口资源管理服务
export * from './windowResourceManager'

// 离线功能服务
export { OfflineService, offlineService } from './offlineService'
export type {
  OfflineDataItem,
  SyncConflict,
  OfflineConfig,
} from './offlineService'

// 网络状态检测服务
export {
  NetworkStatusService,
  networkStatusService,
} from './networkStatusService'
export type {
  NetworkStatus,
  NetworkInfo,
  NetworkStatusCallback,
} from './networkStatusService'

// 离线消息队列服务
export { OfflineMessageQueue, offlineMessageQueue } from './offlineMessageQueue'
export type {
  QueuedMessage,
  MessageSendResult,
  QueueStats,
} from './offlineMessageQueue'
