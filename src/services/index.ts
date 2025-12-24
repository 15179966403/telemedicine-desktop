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
