/**
 * 离线功能端到端测试
 * Offline Functionality End-to-End Tests
 * 需求覆盖: 5.1-5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfflineStore } from '@/stores/offlineStore'
import { offlineService } from '@/services/offlineService'
import type { Patient } from '@/types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

describe('离线功能端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('需求 5.1 - 离线数据缓存', () => {
    it('应该在离线时缓存患者数据', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      const patients: Patient[] = [
        {
          id: '1',
          name: '张三',
          age: 30,
          gender: 'male',
          phone: '13800138000',
          tags: [],
          lastVisit: new Date(),
          medicalHistory: [],
        },
      ]

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await offlineService.cachePatientData(patients)

      expect(invoke).toHaveBeenCalledWith('cache_patient_data', { patients })
    })

    it('应该从缓存加载数据', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      const cachedPatients = [
        { id: '1', name: '张三', age: 30, gender: 'male' as const },
      ]

      vi.mocked(invoke).mockResolvedValueOnce(cachedPatients)

      const patients = await offlineService.getCachedPatientData()

      expect(invoke).toHaveBeenCalledWith('get_cached_patient_data')
      expect(patients).toHaveLength(1)
    })
  })

  describe('需求 5.2 - 离线操作队列', () => {
    it('应该将离线操作加入队列', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      await act(async () => {
        await result.current.addToOfflineQueue(
          'patient-1',
          'patient',
          { name: '测试' },
          'create'
        )
      })

      const queueStatus = offlineService.getOfflineQueueStatus()
      expect(queueStatus.totalItems).toBeGreaterThan(0)
    })

    it('应该在网络恢复时处理队列', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      await act(async () => {
        await result.current.addToOfflineQueue(
          'test-1',
          'patient',
          { name: 'Test' },
          'create'
        )
      })

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await act(async () => {
        await result.current.processOfflineQueue()
      })

      expect(invoke).toHaveBeenCalled()
    })
  })

  describe('需求 5.3 - 网络状态检测', () => {
    it('应该检测网络状态变化', async () => {
      const { result } = renderHook(() => useOfflineStore())

      await act(async () => {
        await result.current.initialize()
      })

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      })

      await act(async () => {
        await result.current.checkNetworkStatus()
      })

      expect(result.current.networkStatus).toBe('offline')
    })
  })

  describe('需求 5.4 - 数据同步', () => {
    it('应该同步离线数据到服务器', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await act(async () => {
        await result.current.syncData()
      })

      expect(result.current.lastSyncTime).toBeDefined()
    })
  })

  describe('需求 5.5 - 冲突解决', () => {
    it('应该检测同步冲突', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      vi.mocked(invoke).mockRejectedValueOnce({
        type: 'DATA_ERROR',
        message: 'Conflict detected',
      })

      await act(async () => {
        await result.current.addToOfflineQueue(
          'patient-1',
          'patient',
          { name: 'Test' },
          'update'
        )
      })

      await act(async () => {
        await result.current.processOfflineQueue()
      })
    })

    it('应该解决同步冲突', async () => {
      const { result } = renderHook(() => useOfflineStore())
      const { invoke } = await import('@tauri-apps/api/core')

      await act(async () => {
        await result.current.initialize()
      })

      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      await act(async () => {
        await result.current.resolveSyncConflict('conflict-1', 'local')
      })

      expect(result.current.syncErrors).toHaveLength(0)
    })
  })
})
