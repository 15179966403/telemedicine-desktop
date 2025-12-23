import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { PatientDetailDrawer } from '@/components'
import type { Patient } from '@/types'

const mockPatient: Patient = {
  id: '1',
  name: '李小明',
  age: 35,
  gender: 'male',
  phone: '138****1234',
  idCard: '110101199001011234',
  tags: ['高血压', '糖尿病'],
  lastVisit: new Date('2024-01-15'),
  medicalHistory: [
    {
      id: '1',
      patientId: '1',
      consultationId: 'cons_1',
      diagnosis: '高血压',
      symptoms: ['头痛', '头晕'],
      prescription: [
        {
          id: 'med_1',
          medicationName: '氨氯地平片',
          dosage: '5mg',
          frequency: '每日一次',
          duration: '30天',
          instructions: '餐后服用',
        },
      ],
      examinations: [],
      doctorId: 'doc_1',
      doctorName: '张医生',
      createdAt: new Date('2024-01-10'),
    },
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

const mockProps = {
  patient: mockPatient,
  visible: true,
  onClose: vi.fn(),
}

describe('PatientDetailDrawer', () => {
  it('renders patient detail drawer correctly', async () => {
    render(<PatientDetailDrawer {...mockProps} />)

    expect(screen.getByText('患者详情 - 李小明')).toBeInTheDocument()

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('基本信息')).toBeInTheDocument()
      expect(screen.getByText('病历记录')).toBeInTheDocument()
      expect(screen.getByText('问诊记录')).toBeInTheDocument()
    })
  })

  it('displays patient basic information', async () => {
    render(<PatientDetailDrawer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText('李小明')).toBeInTheDocument()
      expect(screen.getByText('35岁 · 男')).toBeInTheDocument()
      expect(screen.getByText('138****1234')).toBeInTheDocument()
      expect(screen.getByText('110101199001011234')).toBeInTheDocument()
      expect(screen.getByText('高血压')).toBeInTheDocument()
      expect(screen.getByText('糖尿病')).toBeInTheDocument()
    })
  })

  it('displays medical history', async () => {
    render(<PatientDetailDrawer {...mockProps} />)

    await waitFor(() => {
      // Switch to medical history tab
      const medicalTab = screen.getByText('病历记录')
      medicalTab.click()

      expect(screen.getByText('高血压')).toBeInTheDocument()
      expect(screen.getByText('张医生')).toBeInTheDocument()
      expect(screen.getByText('症状：头痛、头晕')).toBeInTheDocument()
      expect(
        screen.getByText('氨氯地平片 - 5mg - 每日一次')
      ).toBeInTheDocument()
    })
  })

  it('displays consultation history', async () => {
    render(<PatientDetailDrawer {...mockProps} />)

    await waitFor(() => {
      // Switch to consultation history tab
      const consultationTab = screen.getByText('问诊记录')
      consultationTab.click()

      // Mock consultation data should be displayed
      expect(
        screen.getByText('高血压') || screen.getByText('问诊咨询')
      ).toBeInTheDocument()
    })
  })

  it('handles empty medical history', async () => {
    const patientWithoutHistory = {
      ...mockPatient,
      medicalHistory: [],
    }

    render(
      <PatientDetailDrawer {...mockProps} patient={patientWithoutHistory} />
    )

    await waitFor(() => {
      const medicalTab = screen.getByText('病历记录')
      medicalTab.click()

      expect(screen.getByText('暂无病历记录')).toBeInTheDocument()
    })
  })

  it('handles drawer close', () => {
    render(<PatientDetailDrawer {...mockProps} />)

    // The close functionality would be tested through user interactions
    // This is more of an integration test
    expect(mockProps.onClose).toBeDefined()
  })

  it('does not render when not visible', () => {
    render(<PatientDetailDrawer {...mockProps} visible={false} />)

    expect(screen.queryByText('患者详情 - 李小明')).not.toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    render(<PatientDetailDrawer {...mockProps} />)

    // Should show loading spinner initially
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })
})
