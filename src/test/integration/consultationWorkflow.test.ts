import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConsultations } from '@/hooks/useConsultations'
import { consultationService } from '@/services/consultationService'
import type { Consultation } from '@/types'

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

const mockPendingConsultation: Consultation = {
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

const mockActiveConsultation: Consultation = {
  ...mockPendingConsultation,
  id: 'consultation-002',
  status: 'active',
}

const mockCompletedConsultation: Consultation = {
  ...mockPendingConsultation,
  id: 'consultation-003',
  status: 'completed',
  completedAt: new Date('2024-01-01T11:00:00Z'),
}

describe('Consultation Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete consultation workflow', () => {
    it('should handle full consultation lifecycle', async () => {
      // Setup mock responses
      mockConsultationService.getPendingConsultations
        .mockResolvedValueOnce([mockPendingConsultation])
        .mockResolvedValueOnce([mockActiveConsultation])
        .mockResolvedValueOnce([mockCompletedConsultation])

      mockConsultationService.getConsultationDetail.mockResolvedValue(
        mockPendingConsultation
      )
      mockConsultationService.acceptConsultation.mockResolvedValue(undefined)
      mockConsultationService.completeConsultation.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConsultations())

      // Step 1: Load pending consultations
      await act(async () => {
        await result.current.refreshConsultations()
      })

      expect(result.current.pendingConsultations).toHaveLength(1)
      expect(result.current.pendingConsultations[0].status).toBe('pending')

      // Step 2: Get consultation detail
      await act(async () => {
        const success =
          await result.current.fetchConsultationDetail('consultation-001')
        expect(success).toBe(true)
      })

      expect(
        mockConsultationService.getConsultationDetail
      ).toHaveBeenCalledWith('consultation-001')

      // Step 3: Accept consultation
      await act(async () => {
        const success =
          await result.current.acceptConsultation('consultation-001')
        expect(success).toBe(true)
      })

      expect(mockConsultationService.acceptConsultation).toHaveBeenCalledWith(
        'consultation-001'
      )

      // Step 4: Complete consultation
      const summary = '患者感冒症状，建议多休息，多喝水'
      await act(async () => {
        const success = await result.current.completeConsultation(
          'consultation-001',
          summary
        )
        expect(success).toBe(true)
      })

      expect(mockConsultationService.completeConsultation).toHaveBeenCalledWith(
        'consultation-001',
        summary
      )
    })

    it('should handle consultation workflow errors gracefully', async () => {
      // Setup error responses
      mockConsultationService.getPendingConsultations.mockRejectedValue(
        new Error('Network error')
      )
      mockConsultationService.acceptConsultation.mockRejectedValue(
        new Error('Accept failed')
      )

      const { result } = renderHook(() => useConsultations())

      // Test error handling in refresh
      await act(async () => {
        const success = await result.current.refreshConsultations()
        expect(success).toBe(false)
      })

      // Test error handling in accept
      await act(async () => {
        const success =
          await result.current.acceptConsultation('consultation-001')
        expect(success).toBe(false)
      })
    })
  })

  describe('Consultation statistics and utilities', () => {
    it('should provide correct consultation statistics', async () => {
      mockConsultationService.getPendingConsultations.mockResolvedValue([
        mockPendingConsultation,
        mockActiveConsultation,
        mockCompletedConsultation,
      ])

      const { result } = renderHook(() => useConsultations())

      await act(async () => {
        await result.current.refreshConsultations()
      })

      const stats = result.current.getConsultationStats()
      expect(stats).toEqual({
        pending: 1,
        active: 1,
        completed: 1,
        total: 3,
      })
    })

    it('should find consultation by ID', async () => {
      mockConsultationService.getPendingConsultations.mockResolvedValue([
        mockPendingConsultation,
        mockActiveConsultation,
      ])

      const { result } = renderHook(() => useConsultations())

      await act(async () => {
        await result.current.refreshConsultations()
      })

      const foundConsultation =
        result.current.findConsultationById('consultation-001')
      expect(foundConsultation).toEqual(mockPendingConsultation)

      const notFound = result.current.findConsultationById('non-existent')
      expect(notFound).toBeUndefined()
    })

    it('should get high priority consultations', async () => {
      const urgentConsultation = {
        ...mockPendingConsultation,
        id: 'consultation-urgent',
        priority: 'urgent' as const,
      }
      const highConsultation = {
        ...mockPendingConsultation,
        id: 'consultation-high',
        priority: 'high' as const,
      }

      mockConsultationService.getPendingConsultations.mockResolvedValue([
        mockPendingConsultation, // normal priority
        urgentConsultation,
        highConsultation,
      ])

      const { result } = renderHook(() => useConsultations())

      await act(async () => {
        await result.current.refreshConsultations()
      })

      const highPriorityConsultations =
        result.current.getHighPriorityConsultations()
      expect(highPriorityConsultations).toHaveLength(2)
      expect(highPriorityConsultations.map(c => c.priority)).toEqual([
        'urgent',
        'high',
      ])
    })
  })

  describe('Real-time updates', () => {
    it('should update consultation in store', async () => {
      mockConsultationService.getPendingConsultations.mockResolvedValue([
        mockPendingConsultation,
      ])

      const { result } = renderHook(() => useConsultations())

      await act(async () => {
        await result.current.refreshConsultations()
      })

      expect(result.current.pendingConsultations).toHaveLength(1)
      expect(result.current.activeConsultations).toHaveLength(0)

      // Simulate real-time update - consultation becomes active
      const updatedConsultation = {
        ...mockPendingConsultation,
        status: 'active' as const,
        updatedAt: new Date(),
      }

      act(() => {
        result.current.updateConsultationInStore(updatedConsultation)
      })

      expect(result.current.pendingConsultations).toHaveLength(0)
      expect(result.current.activeConsultations).toHaveLength(1)
      expect(result.current.activeConsultations[0].status).toBe('active')
    })
  })

  describe('Error handling and recovery', () => {
    it('should handle service errors and provide fallback', async () => {
      // First call fails, second succeeds
      mockConsultationService.getPendingConsultations
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([mockPendingConsultation])

      const { result } = renderHook(() => useConsultations())

      // First attempt fails
      await act(async () => {
        const success = await result.current.refreshConsultations()
        expect(success).toBe(false)
      })

      expect(result.current.pendingConsultations).toHaveLength(0)

      // Second attempt succeeds
      await act(async () => {
        const success = await result.current.refreshConsultations()
        expect(success).toBe(true)
      })

      expect(result.current.pendingConsultations).toHaveLength(1)
    })

    it('should clear errors when requested', async () => {
      const { result } = renderHook(() => useConsultations())

      // Simulate error state
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
