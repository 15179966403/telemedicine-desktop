import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConsultationStore } from '@/stores/consultationStore'
import { consultationService } from '@/services/consultationService'
import type { Consultation, ConsultationStatus } from '@/types'

// Mock consultation service
vi.mock('@/services/consultationService', () => ({
  consultationService: {
    getPendingConsultations: vi.fn(),
    getConsultationDetail: vi.fn(),
    acceptConsultation: vi.fn(),
    completeConsultation: vi.fn(),
    updateConsultationStatus: vi.fn(),
  },
}))

const mockConsultationService = vi.mocked(consultationService)

const mockConsultation: Consultation = {
  id: 'consultation-001',
  patientId: 'patient-001',
  patientName: '张三',
  doctorId: 'doctor-001',
  type: 'text',
  status: 'pending',
  title: '感冒咨询',
  description: '最近几天感觉头痛、流鼻涕',
  symptoms: ['头痛', '流鼻涕'],
  attachments: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  unreadCount: 0,
  priority: 'normal',
  estimatedDuration: 15,
}

describe('useConsultationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useConsultationStore.setState({
      pendingConsultations: [],
      activeConsultations: [],
      completedConsultations: [],
      selectedConsultation: null,
      loading: false,
      error: null,
      refreshing: false,
    })
  })

  describe('fetchPendingConsultations', () => {
    it('should fetch pending consultations successfully', async () => {
      const mockConsultations = [mockConsultation]
      mockConsultationService.getPendingConsultations.mockResolvedValue(
        mockConsultations
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        await result.current.fetchPendingConsultations()
      })

      expect(mockConsultationService.getPendingConsultations).toHaveBeenCalled()
      expect(result.current.pendingConsultations).toEqual(mockConsultations)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch error', async () => {
      const errorMessage = 'Network error'
      mockConsultationService.getPendingConsultations.mockRejectedValue(
        new Error(errorMessage)
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        await result.current.fetchPendingConsultations()
      })

      expect(result.current.pendingConsultations).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })

    it('should categorize consultations by status', async () => {
      const mockConsultations = [
        { ...mockConsultation, status: 'pending' as ConsultationStatus },
        {
          ...mockConsultation,
          id: 'consultation-002',
          status: 'active' as ConsultationStatus,
        },
        {
          ...mockConsultation,
          id: 'consultation-003',
          status: 'completed' as ConsultationStatus,
        },
      ]
      mockConsultationService.getPendingConsultations.mockResolvedValue(
        mockConsultations
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        await result.current.fetchPendingConsultations()
      })

      expect(result.current.pendingConsultations).toHaveLength(1)
      expect(result.current.activeConsultations).toHaveLength(1)
      expect(result.current.completedConsultations).toHaveLength(1)
    })
  })

  describe('fetchConsultationDetail', () => {
    it('should fetch consultation detail successfully', async () => {
      const consultationId = 'consultation-001'
      mockConsultationService.getConsultationDetail.mockResolvedValue(
        mockConsultation
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        await result.current.fetchConsultationDetail(consultationId)
      })

      expect(
        mockConsultationService.getConsultationDetail
      ).toHaveBeenCalledWith(consultationId)
      expect(result.current.selectedConsultation).toEqual(mockConsultation)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch detail error', async () => {
      const consultationId = 'consultation-001'
      const errorMessage = 'Consultation not found'
      mockConsultationService.getConsultationDetail.mockRejectedValue(
        new Error(errorMessage)
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        await result.current.fetchConsultationDetail(consultationId)
      })

      expect(result.current.selectedConsultation).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('acceptConsultation', () => {
    it('should accept consultation successfully', async () => {
      const consultationId = 'consultation-001'
      mockConsultationService.acceptConsultation.mockResolvedValue(undefined)

      // Set up initial state with pending consultation
      const { result } = renderHook(() => useConsultationStore())
      act(() => {
        result.current.pendingConsultations = [mockConsultation]
      })

      await act(async () => {
        await result.current.acceptConsultation(consultationId)
      })

      expect(mockConsultationService.acceptConsultation).toHaveBeenCalledWith(
        consultationId
      )
      expect(result.current.pendingConsultations).toHaveLength(0)
      expect(result.current.activeConsultations).toHaveLength(1)
      expect(result.current.activeConsultations[0].status).toBe('active')
      expect(result.current.loading).toBe(false)
    })

    it('should handle accept consultation error', async () => {
      const consultationId = 'consultation-001'
      const errorMessage = 'Accept failed'
      mockConsultationService.acceptConsultation.mockRejectedValue(
        new Error(errorMessage)
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        try {
          await result.current.acceptConsultation(consultationId)
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('completeConsultation', () => {
    it('should complete consultation successfully', async () => {
      const consultationId = 'consultation-001'
      const summary = '患者感冒症状，建议多休息'
      mockConsultationService.completeConsultation.mockResolvedValue(undefined)

      // Set up initial state with active consultation
      const activeConsultation = {
        ...mockConsultation,
        status: 'active' as ConsultationStatus,
      }
      const { result } = renderHook(() => useConsultationStore())
      act(() => {
        result.current.activeConsultations = [activeConsultation]
      })

      await act(async () => {
        await result.current.completeConsultation(consultationId, summary)
      })

      expect(mockConsultationService.completeConsultation).toHaveBeenCalledWith(
        consultationId,
        summary
      )
      expect(result.current.activeConsultations).toHaveLength(0)
      expect(result.current.completedConsultations).toHaveLength(1)
      expect(result.current.completedConsultations[0].status).toBe('completed')
      expect(result.current.loading).toBe(false)
    })

    it('should handle complete consultation error', async () => {
      const consultationId = 'consultation-001'
      const errorMessage = 'Complete failed'
      mockConsultationService.completeConsultation.mockRejectedValue(
        new Error(errorMessage)
      )

      const { result } = renderHook(() => useConsultationStore())

      await act(async () => {
        try {
          await result.current.completeConsultation(consultationId)
        } catch (error) {
          // Expected to throw
        }
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('updateConsultationStatus', () => {
    it('should update consultation status successfully', async () => {
      const consultationId = 'consultation-001'
      const status: ConsultationStatus = 'active'
      mockConsultationService.updateConsultationStatus.mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useConsultationStore())
      act(() => {
        result.current.selectedConsultation = mockConsultation
      })

      await act(async () => {
        await result.current.updateConsultationStatus(consultationId, status)
      })

      expect(
        mockConsultationService.updateConsultationStatus
      ).toHaveBeenCalledWith(consultationId, status)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('updateConsultationInStore', () => {
    it('should update consultation in correct list based on status', () => {
      const { result } = renderHook(() => useConsultationStore())

      // Set up initial state
      act(() => {
        result.current.pendingConsultations = [mockConsultation]
      })

      // Update consultation to active status
      const updatedConsultation = {
        ...mockConsultation,
        status: 'active' as ConsultationStatus,
      }

      act(() => {
        result.current.updateConsultationInStore(updatedConsultation)
      })

      expect(result.current.pendingConsultations).toHaveLength(0)
      expect(result.current.activeConsultations).toHaveLength(1)
      expect(result.current.activeConsultations[0].status).toBe('active')
    })

    it('should update selected consultation if it matches', () => {
      const { result } = renderHook(() => useConsultationStore())

      act(() => {
        result.current.selectedConsultation = mockConsultation
      })

      const updatedConsultation = {
        ...mockConsultation,
        title: 'Updated Title',
      }

      act(() => {
        result.current.updateConsultationInStore(updatedConsultation)
      })

      expect(result.current.selectedConsultation?.title).toBe('Updated Title')
    })
  })

  describe('setSelectedConsultation', () => {
    it('should set selected consultation', () => {
      const { result } = renderHook(() => useConsultationStore())

      act(() => {
        result.current.setSelectedConsultation(mockConsultation)
      })

      expect(result.current.selectedConsultation).toEqual(mockConsultation)
    })

    it('should clear selected consultation', () => {
      const { result } = renderHook(() => useConsultationStore())

      act(() => {
        result.current.setSelectedConsultation(mockConsultation)
      })

      expect(result.current.selectedConsultation).toEqual(mockConsultation)

      act(() => {
        result.current.setSelectedConsultation(null)
      })

      expect(result.current.selectedConsultation).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should set and clear error', () => {
      const { result } = renderHook(() => useConsultationStore())
      const errorMessage = 'Test error'

      act(() => {
        result.current.setError(errorMessage)
      })

      expect(result.current.error).toBe(errorMessage)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
