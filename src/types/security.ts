// 安全相关类型定义

export type AuditAction =
  | 'login'
  | 'logout'
  | 'view_patient'
  | 'update_patient'
  | 'send_message'
  | 'upload_file'
  | 'download_file'
  | 'access_sensitive_data'
  | 'change_settings'
  | 'delete_data'

export interface AuditLog {
  id: string
  user_id: string
  action: AuditAction
  resource_type?: string
  resource_id?: string
  ip_address?: string
  user_agent?: string
  status: 'success' | 'failed'
  error_message?: string
  metadata: Record<string, string>
  timestamp: string
}

export type AnomalyType =
  | 'MultipleFailedLogins'
  | 'UnusualAccessPattern'
  | 'SuspiciousFileAccess'
  | 'RapidDataAccess'
  | 'UnauthorizedAccess'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AnomalyRecord {
  id: string
  user_id: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
  detected_at: string
  resolved: boolean
}

export interface LogAuditRequest {
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  status: string
  error_message?: string
  metadata: Record<string, string>
}

export interface GetAuditLogsRequest {
  user_id?: string
  action?: string
  start_time?: string
  end_time?: string
  limit: number
}

export interface SecurityState {
  isLocked: boolean
  lastActivity: Date | null
  autoLockEnabled: boolean
  autoLockTimeout: number // 秒
  anomalies: AnomalyRecord[]
}
