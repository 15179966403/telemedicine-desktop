// 安全功能测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSecurity } from '../hooks/useSecurity'
import { useSecurityStore } from '../stores/securityStore'
import { securityService } from '../services/securityService'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('Security Features', () => {
  beforeEach(() => {
    // 重置 store
    useSecurityStore.setState({
      isLocked: false,
      lastActivity: new Date(),
      autoLockEnabled: true,
      autoLockTimeout: 300,
      anomalies: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('SecurityStore', () => {
    it('should initialize with default values', () => {
      const { isLocked, autoLockEnabled, autoLockTimeout } =
        useSecurityStore.getState()

      expect(isLocked).toBe(false)
      expect(autoLockEnabled).toBe(true)
      expect(autoLockTimeout).toBe(300)
    })

    it('should lock and unlock screen', () => {
      const { lockScreen, unlockScreen } = useSecurityStore.getState()

      act(() => {
        lockScreen()
      })
      expect(useSecurityStore.getState().isLocked).toBe(true)

      act(() => {
        unlockScreen()
      })
      expect(useSecurityStore.getState().isLocked).toBe(false)
    })

    it('should update last activity', () => {
      const { updateActivity } = useSecurityStore.getState()
      const beforeUpdate = useSecurityStore.getState().lastActivity

      // 等待一小段时间
      setTimeout(() => {
        act(() => {
          updateActivity()
        })

        const afterUpdate = useSecurityStore.getState().lastActivity
        expect(afterUpdate.getTime()).toBeGreaterThan(beforeUpdate!.getTime())
      }, 10)
    })

    it('should add anomaly', () => {
      const { addAnomaly } = useSecurityStore.getState()

      const anomaly = {
        id: 'test-1',
        user_id: 'doctor_123',
        anomaly_type: 'MultipleFailedLogins' as const,
        severity: 'high' as const,
        description: 'Test anomaly',
        detected_at: new Date().toISOString(),
        resolved: false,
      }

      act(() => {
        addAnomaly(anomaly)
      })

      const { anomalies } = useSecurityStore.getState()
      expect(anomalies).toHaveLength(1)
      expect(anomalies[0].id).toBe('test-1')
    })
  })

  describe('useSecurity Hook', () => {
    it('should provide security state and methods', () => {
      const { result } = renderHook(() => useSecurity('doctor_123'))

      expect(result.current.isLocked).toBe(false)
      expect(result.current.autoLockEnabled).toBe(true)
      expect(typeof result.current.lockScreen).toBe('function')
      expect(typeof result.current.unlockScreen).toBe('function')
      expect(typeof result.current.logAudit).toBe('function')
    })

    it('should log audit successfully', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue('log-id-123')

      const { result } = renderHook(() => useSecurity('doctor_123'))

      await act(async () => {
        await result.current.logAudit('view_patient', 'patient', 'patient_456')
      })

      expect(invoke).toHaveBeenCalledWith('log_audit', {
        request: expect.objectContaining({
          user_id: 'doctor_123',
          action: 'view_patient',
          resource_type: 'patient',
          resource_id: 'patient_456',
          status: 'success',
        }),
      })
    })

    it('should encrypt and decrypt data', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke)
        .mockResolvedValueOnce('encrypted_data')
        .mockResolvedValueOnce('original_data')

      const { result } = renderHook(() => useSecurity('doctor_123'))

      let encrypted: string = ''
      await act(async () => {
        encrypted = await result.current.encryptData('original_data')
      })
      expect(encrypted).toBe('encrypted_data')

      let decrypted: string = ''
      await act(async () => {
        decrypted = await result.current.decryptData(encrypted)
      })
      expect(decrypted).toBe('original_data')
    })
  })

  describe('SecurityService', () => {
    it('should call encrypt_sensitive_data command', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue('encrypted_result')

      const result = await securityService.encryptSensitiveData('test_data')

      expect(invoke).toHaveBeenCalledWith('encrypt_sensitive_data', {
        data: 'test_data',
      })
      expect(result).toBe('encrypted_result')
    })

    it('should call decrypt_sensitive_data command', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue('decrypted_result')

      const result =
        await securityService.decryptSensitiveData('encrypted_data')

      expect(invoke).toHaveBeenCalledWith('decrypt_sensitive_data', {
        encryptedData: 'encrypted_data',
      })
      expect(result).toBe('decrypted_result')
    })

    it('should record failed login', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(undefined)

      await securityService.recordFailedLogin('doctor_123')

      expect(invoke).toHaveBeenCalledWith('record_failed_login', {
        userId: 'doctor_123',
      })
    })

    it('should check auto lock status', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(true)

      const result = await securityService.shouldAutoLock('doctor_123')

      expect(invoke).toHaveBeenCalledWith('should_auto_lock', {
        userId: 'doctor_123',
      })
      expect(result).toBe(true)
    })

    it('should get audit logs', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'doctor_123',
          action: 'view_patient',
          status: 'success',
          timestamp: new Date().toISOString(),
        },
      ]
      vi.mocked(invoke).mockResolvedValue(mockLogs)

      const result = await securityService.getAuditLogs({
        user_id: 'doctor_123',
        limit: 10,
      })

      expect(invoke).toHaveBeenCalledWith('get_audit_logs', {
        request: {
          user_id: 'doctor_123',
          limit: 10,
        },
      })
      expect(result).toEqual(mockLogs)
    })

    it('should detect anomalies', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mockAnomalies = [
        {
          id: 'anomaly-1',
          user_id: 'doctor_123',
          anomaly_type: 'MultipleFailedLogins',
          severity: 'high',
          description: 'Test anomaly',
          detected_at: new Date().toISOString(),
          resolved: false,
        },
      ]
      vi.mocked(invoke).mockResolvedValue(mockAnomalies)

      const result = await securityService.detectAnomalies('doctor_123')

      expect(invoke).toHaveBeenCalledWith('detect_anomalies', {
        userId: 'doctor_123',
      })
      expect(result).toEqual(mockAnomalies)
    })

    it('should resolve anomaly', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(undefined)

      await securityService.resolveAnomaly('anomaly-123')

      expect(invoke).toHaveBeenCalledWith('resolve_anomaly', {
        anomalyId: 'anomaly-123',
      })
    })

    it('should cleanup old records', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(undefined)

      await securityService.cleanupOldRecords(30)

      expect(invoke).toHaveBeenCalledWith('cleanup_old_security_records', {
        days: 30,
      })
    })
  })

  describe('Auto-lock functionality', () => {
    it('should start and stop auto-lock monitor', () => {
      const { startAutoLockMonitor, stopAutoLockMonitor } =
        useSecurityStore.getState()

      // 启动监控
      act(() => {
        startAutoLockMonitor('doctor_123')
      })

      // 停止监控
      act(() => {
        stopAutoLockMonitor()
      })

      // 验证没有错误
      expect(true).toBe(true)
    })

    it('should not check auto-lock when disabled', async () => {
      const { setAutoLockEnabled, checkAutoLock } = useSecurityStore.getState()

      act(() => {
        setAutoLockEnabled(false)
      })

      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(true)

      await act(async () => {
        await checkAutoLock('doctor_123')
      })

      // 当禁用时不应该调用
      expect(invoke).not.toHaveBeenCalled()
    })

    it('should lock screen when auto-lock timeout reached', async () => {
      const { checkAutoLock } = useSecurityStore.getState()

      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(true)

      await act(async () => {
        await checkAutoLock('doctor_123')
      })

      await waitFor(() => {
        expect(useSecurityStore.getState().isLocked).toBe(true)
      })
    })
  })
})
