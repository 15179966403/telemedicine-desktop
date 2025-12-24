// 自定义 Hook 导出
export { useAuth } from './useAuth'
export { usePatients } from './usePatients'
export { useMessages } from './useMessages'
export { useWindows } from './useWindows'
export { useNotifications } from './useNotifications'

// 问诊相关 hooks
export { useConsultations } from './useConsultations'

// 错误处理和撤销管理 hooks
export { useUndoManager, useUndoKeyboardShortcuts } from './useUndoManager'

// 性能监控 hooks
export { usePerformance, useMemoryMonitor } from './usePerformance'
