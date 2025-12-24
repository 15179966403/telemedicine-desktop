import { invoke } from '@tauri-apps/api/core'
import type { Consultation, ConsultationStatus } from '@/types'

export class ConsultationService {
  private static instance: ConsultationService

  static getInstance(): ConsultationService {
    if (!ConsultationService.instance) {
      ConsultationService.instance = new ConsultationService()
    }
    return ConsultationService.instance
  }

  // 获取待接诊列表
  async getPendingConsultations(): Promise<Consultation[]> {
    try {
      console.log('ConsultationService.getPendingConsultations called')

      const result = await invoke<any>('get_pending_consultations')

      // 转换数据格式
      const consultations: Consultation[] = result.map((item: any) => ({
        id: item.id,
        patientId: item.patient_id,
        patientName: item.patient_name,
        patientAvatar: item.patient_avatar,
        doctorId: item.doctor_id,
        type: item.consultation_type as Consultation['type'],
        status: item.status as ConsultationStatus,
        title: item.title,
        description: item.description,
        symptoms: item.symptoms || [],
        attachments: item.attachments || [],
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at),
        completedAt: item.completed_at
          ? new Date(item.completed_at)
          : undefined,
        lastMessage: item.last_message
          ? {
              id: item.last_message.id,
              consultationId: item.last_message.consultation_id,
              type: item.last_message.message_type,
              content: item.last_message.content,
              sender: item.last_message.sender,
              timestamp: new Date(item.last_message.timestamp),
              status: item.last_message.status,
            }
          : undefined,
        unreadCount: item.unread_count || 0,
        priority: item.priority || 'normal',
        estimatedDuration: item.estimated_duration,
        actualDuration: item.actual_duration,
      }))

      return consultations
    } catch (error) {
      console.error('Get pending consultations failed:', error)

      // 返回模拟数据用于开发测试
      return this.getMockPendingConsultations()
    }
  }

  // 获取问诊详情
  async getConsultationDetail(consultationId: string): Promise<Consultation> {
    try {
      console.log(
        'ConsultationService.getConsultationDetail called with:',
        consultationId
      )

      const result = await invoke<any>('get_consultation_detail', {
        consultationId,
      })

      const consultation: Consultation = {
        id: result.id,
        patientId: result.patient_id,
        patientName: result.patient_name,
        patientAvatar: result.patient_avatar,
        doctorId: result.doctor_id,
        type: result.consultation_type as Consultation['type'],
        status: result.status as ConsultationStatus,
        title: result.title,
        description: result.description,
        symptoms: result.symptoms || [],
        attachments: result.attachments || [],
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        completedAt: result.completed_at
          ? new Date(result.completed_at)
          : undefined,
        lastMessage: result.last_message
          ? {
              id: result.last_message.id,
              consultationId: result.last_message.consultation_id,
              type: result.last_message.message_type,
              content: result.last_message.content,
              sender: result.last_message.sender,
              timestamp: new Date(result.last_message.timestamp),
              status: result.last_message.status,
            }
          : undefined,
        unreadCount: result.unread_count || 0,
        priority: result.priority || 'normal',
        estimatedDuration: result.estimated_duration,
        actualDuration: result.actual_duration,
      }

      return consultation
    } catch (error) {
      console.error('Get consultation detail failed:', error)

      // 返回模拟数据用于开发测试
      return this.getMockConsultationDetail(consultationId)
    }
  }

  // 接受问诊
  async acceptConsultation(consultationId: string): Promise<void> {
    try {
      console.log(
        'ConsultationService.acceptConsultation called with:',
        consultationId
      )

      await invoke('accept_consultation', { consultationId })
    } catch (error) {
      console.error('Accept consultation failed:', error)
      throw new Error('接受问诊失败')
    }
  }

  // 完成问诊
  async completeConsultation(
    consultationId: string,
    summary?: string
  ): Promise<void> {
    try {
      console.log('ConsultationService.completeConsultation called with:', {
        consultationId,
        summary,
      })

      await invoke('complete_consultation', {
        consultationId,
        summary: summary || '',
      })
    } catch (error) {
      console.error('Complete consultation failed:', error)
      throw new Error('完成问诊失败')
    }
  }

  // 更新问诊状态
  async updateConsultationStatus(
    consultationId: string,
    status: ConsultationStatus
  ): Promise<void> {
    try {
      console.log('ConsultationService.updateConsultationStatus called with:', {
        consultationId,
        status,
      })

      await invoke('update_consultation_status', { consultationId, status })
    } catch (error) {
      console.error('Update consultation status failed:', error)
      throw new Error('更新问诊状态失败')
    }
  }

  // 获取问诊历史
  async getConsultationHistory(
    doctorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    consultations: Consultation[]
    total: number
    page: number
  }> {
    try {
      console.log('ConsultationService.getConsultationHistory called with:', {
        doctorId,
        page,
        limit,
      })

      const result = await invoke<any>('get_consultation_history', {
        doctorId,
        page,
        limit,
      })

      const consultations: Consultation[] = result.consultations.map(
        (item: any) => ({
          id: item.id,
          patientId: item.patient_id,
          patientName: item.patient_name,
          patientAvatar: item.patient_avatar,
          doctorId: item.doctor_id,
          type: item.consultation_type as Consultation['type'],
          status: item.status as ConsultationStatus,
          title: item.title,
          description: item.description,
          symptoms: item.symptoms || [],
          attachments: item.attachments || [],
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          completedAt: item.completed_at
            ? new Date(item.completed_at)
            : undefined,
          lastMessage: item.last_message
            ? {
                id: item.last_message.id,
                consultationId: item.last_message.consultation_id,
                type: item.last_message.message_type,
                content: item.last_message.content,
                sender: item.last_message.sender,
                timestamp: new Date(item.last_message.timestamp),
                status: item.last_message.status,
              }
            : undefined,
          unreadCount: item.unread_count || 0,
          priority: item.priority || 'normal',
          estimatedDuration: item.estimated_duration,
          actualDuration: item.actual_duration,
        })
      )

      return {
        consultations,
        total: result.total,
        page: result.page,
      }
    } catch (error) {
      console.error('Get consultation history failed:', error)
      throw new Error('获取问诊历史失败')
    }
  }

  // 模拟数据 - 待接诊列表
  private getMockPendingConsultations(): Consultation[] {
    return [
      {
        id: 'consultation-001',
        patientId: 'patient-001',
        patientName: '张三',
        patientAvatar: undefined,
        doctorId: 'doctor-001',
        type: 'text',
        status: 'pending',
        title: '感冒咨询',
        description: '最近几天感觉头痛、流鼻涕，想咨询一下是否需要用药',
        symptoms: ['头痛', '流鼻涕', '轻微发热'],
        attachments: [],
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
        unreadCount: 0,
        priority: 'normal',
        estimatedDuration: 15,
      },
      {
        id: 'consultation-002',
        patientId: 'patient-002',
        patientName: '李四',
        patientAvatar: undefined,
        doctorId: 'doctor-001',
        type: 'text',
        status: 'pending',
        title: '高血压复查',
        description: '上次开的降压药已经服用一个月，想复查一下血压情况',
        symptoms: ['血压偏高', '偶尔头晕'],
        attachments: [
          {
            id: 'file-001',
            name: '血压监测记录.pdf',
            size: 1024000,
            type: 'application/pdf',
            url: '/files/blood-pressure-record.pdf',
          },
        ],
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1小时前
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
        unreadCount: 0,
        priority: 'high',
        estimatedDuration: 20,
      },
      {
        id: 'consultation-003',
        patientId: 'patient-003',
        patientName: '王五',
        patientAvatar: undefined,
        doctorId: 'doctor-001',
        type: 'text',
        status: 'pending',
        title: '皮肤过敏咨询',
        description: '手臂出现红疹，很痒，不知道是什么原因引起的',
        symptoms: ['皮肤红疹', '瘙痒'],
        attachments: [
          {
            id: 'file-002',
            name: '皮肤照片.jpg',
            size: 512000,
            type: 'image/jpeg',
            url: '/files/skin-photo.jpg',
          },
        ],
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15分钟前
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
        unreadCount: 0,
        priority: 'urgent',
        estimatedDuration: 10,
      },
    ]
  }

  // 模拟数据 - 问诊详情
  private getMockConsultationDetail(consultationId: string): Consultation {
    const mockConsultations = this.getMockPendingConsultations()
    const consultation = mockConsultations.find(c => c.id === consultationId)

    if (consultation) {
      return consultation
    }

    // 如果没找到，返回默认的详情
    return {
      id: consultationId,
      patientId: 'patient-default',
      patientName: '患者',
      doctorId: 'doctor-001',
      type: 'text',
      status: 'pending',
      title: '问诊咨询',
      description: '患者咨询相关问题',
      symptoms: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      unreadCount: 0,
      priority: 'normal',
      estimatedDuration: 15,
    }
  }
}

// 导出单例实例
export const consultationService = ConsultationService.getInstance()
