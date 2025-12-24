import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { ConsultationService } from '@/services/consultationService'
import type { Consultation, ConsultationStatus } from '@/types'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe('ConsultationService', () => {
  let consultationService: ConsultationService

  beforeEach(() => {
    consultationService = ConsultationService.getInstance()
    vi.clearAllMocks()
  })

  describe('getPendingConsultations', () => {
    it('should fetch pending consultations successfully', async () => {
      const mockData = [
        {
          id: 'consultation-001',
          patient_id: 'patient-001',
          patient_name: '张三',
          patient_avatar: null,
          doctor_id: 'doctor-001',
          consultation_type: 'text',
          status: 'pending',
          title: '感冒咨询',
          description: '最近几天感觉头痛、流鼻涕',
          symptoms: ['头痛', '流鼻涕'],
          attachments: [],
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          completed_at: null,
          last_message: null,
          unread_count: 0,
          priority: 'normal',
          estimated_duration: 15,
          actual_duration: null,
        },
      ]

      mockInvoke.mockResolvedValue(mockData)

      const result = await consultationService.getPendingConsultations()

      expect(mockInvoke).toHaveBeenCalledWith('get_pending_consultations')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'consultation-001',
        patientId: 'patient-001',
        patientName: '张三',
        status: 'pending',
        title: '感冒咨询',
        priority: 'normal',
      })
    })

    it('should return mock data when Tauri call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'))

      const result = await consultationService.getPendingConsultations()

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('patientName')
    })
  })

  describe('getConsultationDetail', () => {
    it('should fetch consultation detail successfully', async () => {
      const consultationId = 'consultation-001'
      const mockData = {
        id: consultationId,
        patient_id: 'patient-001',
        patient_name: '张三',
        patient_avatar: null,
        doctor_id: 'doctor-001',
        consultation_type: 'text',
        status: 'pending',
        title: '感冒咨询',
        description: '最近几天感觉头痛、流鼻涕',
        symptoms: ['头痛', '流鼻涕'],
        attachments: [],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        completed_at: null,
        last_message: null,
        unread_count: 0,
        priority: 'normal',
        estimated_duration: 15,
        actual_duration: null,
      }

      mockInvoke.mockResolvedValue(mockData)

      const result =
        await consultationService.getConsultationDetail(consultationId)

      expect(mockInvoke).toHaveBeenCalledWith('get_consultation_detail', {
        consultationId,
      })
      expect(result).toMatchObject({
        id: consultationId,
        patientId: 'patient-001',
        patientName: '张三',
        status: 'pending',
        title: '感冒咨询',
      })
    })

    it('should return mock data when consultation not found', async () => {
      const consultationId = 'non-existent'
      mockInvoke.mockRejectedValue(new Error('Consultation not found'))

      const result =
        await consultationService.getConsultationDetail(consultationId)

      expect(result).toMatchObject({
        id: consultationId,
        patientName: '患者',
        status: 'pending',
      })
    })
  })

  describe('acceptConsultation', () => {
    it('should accept consultation successfully', async () => {
      const consultationId = 'consultation-001'
      mockInvoke.mockResolvedValue(undefined)

      await expect(
        consultationService.acceptConsultation(consultationId)
      ).resolves.not.toThrow()

      expect(mockInvoke).toHaveBeenCalledWith('accept_consultation', {
        consultationId,
      })
    })

    it('should throw error when accept fails', async () => {
      const consultationId = 'consultation-001'
      mockInvoke.mockRejectedValue(new Error('Accept failed'))

      await expect(
        consultationService.acceptConsultation(consultationId)
      ).rejects.toThrow('接受问诊失败')
    })
  })

  describe('completeConsultation', () => {
    it('should complete consultation successfully', async () => {
      const consultationId = 'consultation-001'
      const summary = '患者感冒症状，建议多休息'
      mockInvoke.mockResolvedValue(undefined)

      await expect(
        consultationService.completeConsultation(consultationId, summary)
      ).resolves.not.toThrow()

      expect(mockInvoke).toHaveBeenCalledWith('complete_consultation', {
        consultationId,
        summary,
      })
    })

    it('should complete consultation without summary', async () => {
      const consultationId = 'consultation-001'
      mockInvoke.mockResolvedValue(undefined)

      await expect(
        consultationService.completeConsultation(consultationId)
      ).resolves.not.toThrow()

      expect(mockInvoke).toHaveBeenCalledWith('complete_consultation', {
        consultationId,
        summary: '',
      })
    })

    it('should throw error when complete fails', async () => {
      const consultationId = 'consultation-001'
      mockInvoke.mockRejectedValue(new Error('Complete failed'))

      await expect(
        consultationService.completeConsultation(consultationId)
      ).rejects.toThrow('完成问诊失败')
    })
  })

  describe('updateConsultationStatus', () => {
    it('should update consultation status successfully', async () => {
      const consultationId = 'consultation-001'
      const status: ConsultationStatus = 'active'
      mockInvoke.mockResolvedValue(undefined)

      await expect(
        consultationService.updateConsultationStatus(consultationId, status)
      ).resolves.not.toThrow()

      expect(mockInvoke).toHaveBeenCalledWith('update_consultation_status', {
        consultationId,
        status,
      })
    })

    it('should throw error when update fails', async () => {
      const consultationId = 'consultation-001'
      const status: ConsultationStatus = 'active'
      mockInvoke.mockRejectedValue(new Error('Update failed'))

      await expect(
        consultationService.updateConsultationStatus(consultationId, status)
      ).rejects.toThrow('更新问诊状态失败')
    })
  })

  describe('getConsultationHistory', () => {
    it('should fetch consultation history successfully', async () => {
      const doctorId = 'doctor-001'
      const page = 1
      const limit = 20
      const mockData = {
        consultations: [
          {
            id: 'consultation-001',
            patient_id: 'patient-001',
            patient_name: '张三',
            status: 'completed',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T11:00:00Z',
            completed_at: '2024-01-01T11:00:00Z',
          },
        ],
        total: 1,
        page: 1,
      }

      mockInvoke.mockResolvedValue(mockData)

      const result = await consultationService.getConsultationHistory(
        doctorId,
        page,
        limit
      )

      expect(mockInvoke).toHaveBeenCalledWith('get_consultation_history', {
        doctorId,
        page,
        limit,
      })
      expect(result).toMatchObject({
        consultations: expect.any(Array),
        total: 1,
        page: 1,
      })
      expect(result.consultations).toHaveLength(1)
    })

    it('should throw error when fetch history fails', async () => {
      const doctorId = 'doctor-001'
      mockInvoke.mockRejectedValue(new Error('Fetch failed'))

      await expect(
        consultationService.getConsultationHistory(doctorId)
      ).rejects.toThrow('获取问诊历史失败')
    })
  })
})
