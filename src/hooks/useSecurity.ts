// 安全功能 Hook

import { useEffect, useCallback } from 'react'
import {
  useSecurityStore,
  setupActivityListeners,
  cleanupActivityListeners,
} from '../stores/securityStore'
import { securityService } from '../services/securityService'
import type { AuditAction, LogAuditRequest } from '../types/security'

export const useSecurity = (userId?: string) => {
  const {
    isLocked,
    lastActivity,
    autoLockEnabled,
    autoLockTimeout,
    anomalies,
    setLocked,
    setAutoLockEnabled,
    setAutoLockTimeout,
    updateActivity,
    startAutoLockMonitor,
    stopAutoLockMonitor,
    lockScreen,
    unlockScreen,
    loadAnomalies,
  } = useSecurityStore()

  // 初始化安全监控
  useEffect(() => {
    if (userId && autoLockEnabled) {
      setupActivityListeners()
      startAutoLockMonitor(userId)

      return () => {
        cleanupActivityListeners()
        stopAutoLockMonitor()
      }
    }
  }, [userId, autoLockEnabled, startAutoLockMonitor, stopAutoLockMonitor])

  // 记录操作日志
  const logAudit = useCallback(
    async (
      action: AuditAction,
      resourceType?: string,
      resourceId?: string,
      metadata?: Record<string, string>
    ) => {
      if (!userId) return

      try {
        const request: LogAuditRequest = {
          user_id: userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          status: 'success',
          metadata: metadata || {},
        }
        await securityService.logAudit(request)
      } catch (error) {
        console.error('记录操作日志失败:', error)
      }
    },
    [userId]
  )

  // 记录失败的操作
  const logFailedAudit = useCallback(
    async (
      action: AuditAction,
      errorMessage: string,
      resourceType?: string,
      resourceId?: string
    ) => {
      if (!userId) return

      try {
        const request: LogAuditRequest = {
          user_id: userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          status: 'failed',
          error_message: errorMessage,
          metadata: {},
        }
        await securityService.logAudit(request)
      } catch (error) {
        console.error('记录失败日志失败:', error)
      }
    },
    [userId]
  )

  // 检测异常
  const detectAnomalies = useCallback(async () => {
    if (!userId) return

    try {
      const detected = await securityService.detectAnomalies(userId)
      if (detected.length > 0) {
        console.warn('检测到异常访问:', detected)
        await loadAnomalies(userId)
      }
    } catch (error) {
      console.error('检测异常失败:', error)
    }
  }, [userId, loadAnomalies])

  // 加密敏感数据
  const encryptData = useCallback(async (data: string) => {
    try {
      return await securityService.encryptSensitiveData(data)
    } catch (error) {
      console.error('加密数据失败:', error)
      throw error
    }
  }, [])

  // 解密敏感数据
  const decryptData = useCallback(async (encryptedData: string) => {
    try {
      return await securityService.decryptSensitiveData(encryptedData)
    } catch (error) {
      console.error('解密数据失败:', error)
      throw error
    }
  }, [])

  return {
    // 状态
    isLocked,
    lastActivity,
    autoLockEnabled,
    autoLockTimeout,
    anomalies,

    // 方法
    setLocked,
    setAutoLockEnabled,
    setAutoLockTimeout,
    updateActivity,
    lockScreen,
    unlockScreen,
    logAudit,
    logFailedAudit,
    detectAnomalies,
    encryptData,
    decryptData,
    loadAnomalies: () => userId && loadAnomalies(userId),
  }
}
