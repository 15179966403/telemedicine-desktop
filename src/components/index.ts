// 组件导出文件

// 窗口管理组件
export { WindowManager } from './WindowManager'
export { PatientDetailDrawer } from './PatientDetailDrawer'
export { PatientTagManager } from './PatientTagManager'

// 聊天界面组件
export {
  ChatInterface,
  MessageList,
  MessageInput,
  MedicalTemplates,
} from './ChatInterface'

// 文件管理组件
export { FileUploadComponent } from './FileUpload'
export { FilePreviewComponent } from './FilePreview'

// 问诊管理组件
export * from './ConsultationList'
export * from './ConsultationDetail'

// 通用组件
export { WebSocketStatus } from './WebSocketStatus'

// 离线功能组件
export * from './OfflineIndicator'
export * from './SyncConflictResolver'
export * from './OfflineQueueStatus'

// 错误处理和用户体验组件
export { ErrorBoundary } from './ErrorBoundary'
export { ErrorMessage, InlineError } from './ErrorMessage'
export {
  LoadingSpinner,
  ProgressBar,
  CircularProgress,
  Skeleton,
  LoadingWrapper,
} from './LoadingIndicator'
export { ConfirmDialog, useConfirmDialog } from './ConfirmDialog'
