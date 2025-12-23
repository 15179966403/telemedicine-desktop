import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PatientCacheService } from '@/services/patientCacheService'
import { StorageService } from '@/utils/storage'
import type { Patient, PatientQuery, PatientList } from '@/types'

// Mock StorageService
vi.mock('@/utils/storage', () => ({
  StorageService: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn(),
  },
}))

const mockPatient: Patient = {
  id: '1',
  name: '李小明',
  age: 35,
  gender: 'male',
  phone: '138****1234',
  tags: ['高血压', '糖尿病'],
  lastVisit: new Date('2024-01-15'),
  medicalHistory: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

const mockPatientList: PatientList = {
  patients: [mockPatient],
  total: 1,
  page: 1,
  pageSize: 20,
}

const mockQuery: PatientQuery = {
  keyword: 'test',
  page: 1,
  pageSize: 20,
}

describe('PatientCacheService', () => {
  let cacheService: PatientCacheService

  beforeEach(() => {
    cacheService = PatientCacheService.getInstance()
    vi.clearAllMocks()
  })

  describe('cachePatientList', () => {
    it('should cache patient list successfully', async () => {
      vi.mocked(StorageService.setItem).mockResolvedValue(undefined)

      await cacheService.cachePatientList(mockQuery, mockPatientList)

      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('patient_cache_list_'),
        expect.objectContaining({
          data: mockPatientList,
          timestamp: expect.any(Number),
          expiry: expect.any(Number),
        })
      )
    })

    it('should handle cache errors gracefully', async () => {
      vi.mocked(StorageService.setItem).mockRejectedValue(
        new Error('Storage error')
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await cacheService.cachePatientList(mockQuery, mockPatientList)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cache patient list:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('getCachedPatientList', () => {
    it('should return cached patient list when valid', async () => {
      const cachedData = {
        data: mockPatientList,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
      }

      vi.mocked(StorageService.getItem).mockResolvedValue(cachedData)

      const result = await cacheService.getCachedPatientList(mockQuery)

      expect(result).toEqual(mockPatientList)
    })

    it('should return null when cache is expired', async () => {
      const expiredData = {
        data: mockPatientList,
        timestamp: Date.now(),
        expiry: Date.now() - 1000, // Expired 1 second ago
      }

      vi.mocked(StorageService.getItem).mockResolvedValue(expiredData)

      const result = await cacheService.getCachedPatientList(mockQuery)

      expect(result).toBeNull()
    })

    it('should return null when no cache exists', async () => {
      vi.mocked(StorageService.getItem).mockResolvedValue(null)

      const result = await cacheService.getCachedPatientList(mockQuery)

      expect(result).toBeNull()
    })

    it('should handle cache retrieval errors gracefully', async () => {
      vi.mocked(StorageService.getItem).mockRejectedValue(
        new Error('Storage error')
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await cacheService.getCachedPatientList(mockQuery)

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get cached patient list:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('cachePatient', () => {
    it('should cache individual patient successfully', async () => {
      vi.mocked(StorageService.setItem).mockResolvedValue(undefined)
      vi.mocked(StorageService.getItem).mockResolvedValue([])

      await cacheService.cachePatient(mockPatient)

      expect(StorageService.setItem).toHaveBeenCalledWith(
        'patient_cache_patient_1',
        expect.objectContaining({
          data: mockPatient,
          timestamp: expect.any(Number),
          expiry: expect.any(Number),
        })
      )
    })
  })

  describe('getCachedPatient', () => {
    it('should return cached patient when valid', async () => {
      const cachedData = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }

      vi.mocked(StorageService.getItem).mockResolvedValue(cachedData)

      const result = await cacheService.getCachedPatient('1')

      expect(result).toEqual(mockPatient)
    })

    it('should return null when cache is expired', async () => {
      const expiredData = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() - 1000,
      }

      vi.mocked(StorageService.getItem).mockResolvedValue(expiredData)

      const result = await cacheService.getCachedPatient('1')

      expect(result).toBeNull()
    })
  })

  describe('updatePatientCache', () => {
    it('should update existing patient cache', async () => {
      const cachedData = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }

      vi.mocked(StorageService.getItem).mockResolvedValue(cachedData)
      vi.mocked(StorageService.setItem).mockResolvedValue(undefined)

      const updates = { tags: ['高血压', '糖尿病', '心脏病'] }
      await cacheService.updatePatientCache('1', updates)

      expect(StorageService.setItem).toHaveBeenCalledWith(
        'patient_cache_patient_1',
        expect.objectContaining({
          data: expect.objectContaining(updates),
        })
      )
    })
  })

  describe('searchCachedPatients', () => {
    it('should search patients by name', async () => {
      const patientIndex = ['1', '2']
      const cachedPatient1 = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }
      const cachedPatient2 = {
        data: { ...mockPatient, id: '2', name: '王小红' },
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }

      vi.mocked(StorageService.getItem)
        .mockResolvedValueOnce(patientIndex) // For patient index
        .mockResolvedValueOnce(cachedPatient1) // For patient 1
        .mockResolvedValueOnce(cachedPatient2) // For patient 2

      const results = await cacheService.searchCachedPatients('李')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('李小明')
    })

    it('should search patients by phone', async () => {
      const patientIndex = ['1']
      const cachedPatient = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }

      vi.mocked(StorageService.getItem)
        .mockResolvedValueOnce(patientIndex)
        .mockResolvedValueOnce(cachedPatient)

      const results = await cacheService.searchCachedPatients('138')

      expect(results).toHaveLength(1)
      expect(results[0].phone).toBe('138****1234')
    })

    it('should search patients by tags', async () => {
      const patientIndex = ['1']
      const cachedPatient = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
      }

      vi.mocked(StorageService.getItem)
        .mockResolvedValueOnce(patientIndex)
        .mockResolvedValueOnce(cachedPatient)

      const results = await cacheService.searchCachedPatients('高血压')

      expect(results).toHaveLength(1)
      expect(results[0].tags).toContain('高血压')
    })
  })

  describe('cleanExpiredCache', () => {
    it('should remove expired cache entries', async () => {
      const allKeys = [
        'patient_cache_list_abc',
        'patient_cache_patient_1',
        'other_cache_key',
      ]
      const expiredData = {
        data: mockPatient,
        timestamp: Date.now(),
        expiry: Date.now() - 1000, // Expired
      }

      vi.mocked(StorageService.getAllKeys).mockResolvedValue(allKeys)
      vi.mocked(StorageService.getItem).mockResolvedValue(expiredData)
      vi.mocked(StorageService.removeItem).mockResolvedValue(undefined)

      await cacheService.cleanExpiredCache()

      expect(StorageService.removeItem).toHaveBeenCalledWith(
        'patient_cache_list_abc'
      )
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        'patient_cache_patient_1'
      )
      expect(StorageService.removeItem).not.toHaveBeenCalledWith(
        'other_cache_key'
      )
    })
  })

  describe('clearAllCache', () => {
    it('should remove all patient cache entries', async () => {
      const allKeys = [
        'patient_cache_list_abc',
        'patient_cache_patient_1',
        'other_cache_key',
      ]

      vi.mocked(StorageService.getAllKeys).mockResolvedValue(allKeys)
      vi.mocked(StorageService.removeItem).mockResolvedValue(undefined)

      await cacheService.clearAllCache()

      expect(StorageService.removeItem).toHaveBeenCalledWith(
        'patient_cache_list_abc'
      )
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        'patient_cache_patient_1'
      )
      expect(StorageService.removeItem).not.toHaveBeenCalledWith(
        'other_cache_key'
      )
    })
  })

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const patientIndex = ['1', '2', '3']
      const allKeys = [
        'patient_cache_list_abc',
        'patient_cache_patient_1',
        'patient_cache_patient_2',
        'other_cache_key',
      ]

      vi.mocked(StorageService.getItem).mockResolvedValue(patientIndex)
      vi.mocked(StorageService.getAllKeys).mockResolvedValue(allKeys)

      const stats = await cacheService.getCacheStats()

      expect(stats.totalPatients).toBe(3)
      expect(stats.cacheSize).toBe(3) // Only patient cache keys
      expect(stats.lastCleanup).toBeGreaterThan(0)
    })
  })
})
