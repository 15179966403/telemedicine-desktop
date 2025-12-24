import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PendingConsultationList } from '@/components/ConsultationList/PendingConsultationList'
import { useConsultationStore } from '@/stores/consultationStore'
import { useWindowStore } from '@/stores/windowStore'
import type { Consultation } from '@/types'

// Mock stores
vi.mock('@/stores/consultationStore')
vi.mock('@/stores/windowStore')

const mockUseConsultationStore = vi.mocked(useConsultationStore)
const mockUseWindowStore = vi.mocked(useWindowStore)

const mockConsultation: Consultation = {
  id: 'consultation-001',
  patientId: 'patient-001',
  patientName: '张三',
  doctorId: 'doctor-001',
  type: 'text',
  status: 'pending',
  title: '感冒咨询',
  description: '最近几天感觉头痛、流鼻涕，想咨询一下是否需要用药',
  symptoms: ['头痛', '流鼻涕', '轻微发热'],
  attachments: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  unreadCount: 0,
  priority: 'normal',
  estimatedDuration: 15,
}

const mockConsultationStore = {
  pendingConsultations: [mockConsultation],
  loading: false,
  error: null,
  refreshing: false,
  fetchPendingConsultations: vi.fn(),
  acceptConsultation: vi.fn(),
  setSelectedConsultation: vi.fn(),
  clearError: vi.fn(),
}

const mockWindowStore = {
  createWindow: vi.fn(),
}

describe('PendingConsultationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseConsultationStore.mockReturnValue(mockConsultationStore as any)
    mockUseWindowStore.mockReturnValue(mockWindowStore as any)
  })

  it('should render pending consultations list', () => {
    render(<PendingConsultationList />)

    expect(screen.getByText('待接诊列表')).toBeInTheDocument()
    expect(screen.getByText('感冒咨询')).toBeInTheDocument()
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.getByText('图文问诊')).toBeInTheDocument()
    expect(screen.getByText('普通')).toBeInTheDocument()
  })

  it('should display consultation symptoms', () => {
    render(<PendingConsultationList />)

    expect(screen.getByText('头痛')).toBeInTheDocument()
    expect(screen.getByText('流鼻涕')).toBeInTheDocument()
    expect(screen.getByText('轻微发热')).toBeInTheDocument()
  })

  it('should display estimated duration', () => {
    render(<PendingConsultationList />)

    expect(screen.getByText('预计 15 分钟')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      loading: true,
      pendingConsultations: [],
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText('加载待接诊列表中...')).toBeInTheDocument()
  })

  it('should show empty state when no consultations', () => {
    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      pendingConsultations: [],
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText('暂无待接诊的问诊')).toBeInTheDocument()
  })

  it('should show error message', () => {
    const errorMessage = '网络连接失败'
    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      error: errorMessage,
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('should handle view detail button click', () => {
    const onSelectConsultation = vi.fn()
    render(
      <PendingConsultationList onSelectConsultation={onSelectConsultation} />
    )

    const detailButton = screen.getByText('详情')
    fireEvent.click(detailButton)

    expect(mockConsultationStore.setSelectedConsultation).toHaveBeenCalledWith(
      mockConsultation
    )
    expect(onSelectConsultation).toHaveBeenCalledWith(mockConsultation)
  })

  it('should handle accept consultation button click', async () => {
    mockConsultationStore.acceptConsultation.mockResolvedValue(undefined)
    mockWindowStore.createWindow.mockResolvedValue('window-id')

    render(<PendingConsultationList />)

    const acceptButton = screen.getByText('接受')
    fireEvent.click(acceptButton)

    // Wait for confirmation modal
    await waitFor(() => {
      expect(screen.getByText('确认接受问诊')).toBeInTheDocument()
    })

    const confirmButton = screen.getByText('确定')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockConsultationStore.acceptConsultation).toHaveBeenCalledWith(
        'consultation-001'
      )
      expect(mockWindowStore.createWindow).toHaveBeenCalledWith({
        type: 'consultation',
        title: '问诊 - 张三',
        url: '/consultation/consultation-001',
        data: {
          consultationId: 'consultation-001',
          patientName: '张三',
        },
        size: { width: 1000, height: 700 },
        position: { x: 100, y: 100 },
      })
    })
  })

  it('should handle refresh button click', () => {
    render(<PendingConsultationList />)

    const refreshButton = screen.getByText('刷新')
    fireEvent.click(refreshButton)

    expect(mockConsultationStore.fetchPendingConsultations).toHaveBeenCalled()
  })

  it('should display priority colors correctly', () => {
    const urgentConsultation = {
      ...mockConsultation,
      id: 'consultation-urgent',
      priority: 'urgent' as const,
    }

    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      pendingConsultations: [urgentConsultation],
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText('紧急')).toBeInTheDocument()
  })

  it('should display attachments', () => {
    const consultationWithAttachments = {
      ...mockConsultation,
      attachments: [
        {
          id: 'file-001',
          name: '血压监测记录.pdf',
          size: 1024000,
          type: 'application/pdf',
          url: '/files/blood-pressure-record.pdf',
        },
      ],
    }

    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      pendingConsultations: [consultationWithAttachments],
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText('血压监测记录.pdf')).toBeInTheDocument()
  })

  it('should format time correctly', () => {
    // Mock consultation created 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const recentConsultation = {
      ...mockConsultation,
      createdAt: thirtyMinutesAgo,
    }

    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      pendingConsultations: [recentConsultation],
    } as any)

    render(<PendingConsultationList />)

    expect(screen.getByText('30分钟前')).toBeInTheDocument()
  })

  it('should handle error clearing', () => {
    const errorMessage = '网络连接失败'
    mockUseConsultationStore.mockReturnValue({
      ...mockConsultationStore,
      error: errorMessage,
    } as any)

    render(<PendingConsultationList />)

    const closeButton = screen.getByText('关闭')
    fireEvent.click(closeButton)

    expect(mockConsultationStore.clearError).toHaveBeenCalled()
  })
})
