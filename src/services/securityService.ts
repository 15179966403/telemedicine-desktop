// 安全服务

import { invoke } from '@tauri-apps/api/core'
import type {
  AuditLog,
  AnomalyRecord,
  LogAuditRequest,
  GetAuditLogsRequest,
} from '../types/security'

class SecurityService {
  /**
   * 加密敏感数据
   */
  async encryptSensitiveData(data: string): Promise<string> {
    return await invoke<string>('encrypt_sensitive_data', { data })
  }

  /**
   * 解密敏感数据
   */
  async decryptSensitiveData(encryptedData: string): Promise<string> {
    return await invoke<string>('decrypt_sensitive_data', {
      encryptedData,
    })
  }

  /**
   * 记录操作日志
   */
  async logAudit(request: LogAuditRequest): Promise<string> {
    return await invoke<string>('log_audit', { request })
  }

  /**
   * 获取操作日志
   */
  async getAuditLogs(request: GetAuditLogsRequest): Promise<AuditLog[]> {
    return await invoke<AuditLog[]>('get_audit_logs', { request })
  }

  /**
   * 检测异常访问
   */
  async detectAnomalies(userId: string): Promise<AnomalyRecord[]> {
    return await invoke<AnomalyRecord[]>('detect_anomalies', { userId })
  }

  /**
   * 记录登录失败
   */
  async recordFailedLogin(userId: string): Promise<void> {
    await invoke('record_failed_login', { userId })
  }

  /**
   * 重置登录失败计数
   */
  async resetFailedLogin(userId: string): Promise<void> {
    await invoke('reset_failed_login', { userId })
  }

  /**
   * 检查是否需要自动锁屏
   */
  async shouldAutoLock(userId: string): Promise<boolean> {
    return await invoke<boolean>('should_auto_lock', { userId })
  }

  /**
   * 获取最后活动时间
   */
  async getLastActivity(userId: string): Promise<string | null> {
    return await invoke<string | null>('get_last_activity', { userId })
  }

  /**
   * 获取异常记录
   */
  async getAnomalyRecords(
    userId?: string,
    resolved?: boolean
  ): Promise<AnomalyRecord[]> {
    return await invoke<AnomalyRecord[]>('get_anomaly_records', {
      userId,
      resolved,
    })
  }

  /**
   * 标记异常已解决
   */
  async resolveAnomaly(anomalyId: string): Promise<void> {
    await invoke('resolve_anomaly', { anomalyId })
  }

  /**
   * 清理旧的日志和记录
   */
  async cleanupOldRecords(days: number): Promise<void> {
    await invoke('cleanup_old_security_records', { days })
  }
}

export const securityService = new SecurityService()
