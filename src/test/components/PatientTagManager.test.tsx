import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { PatientTagManager } from '@/components'
import type { Patient } from '@/types'

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

const mockProps = {
  patient: mockPatient,
  visible: true,
  allTags: ['高血压', '糖尿病', '心脏病', '哮喘', '孕期检查'],
  onClose: vi.fn(),
  onUpdateTags: vi.fn(),
}

describe('PatientTagManager', () => {
  it('renders tag manager correctly', () => {
    render(<PatientTagManager {...mockProps} />)

    expect(screen.getByText('管理标签 - 李小明')).toBeInTheDocument()
    expect(screen.getByText('当前标签')).toBeInTheDocument()
    expect(screen.getByText('添加新标签')).toBeInTheDocument()
    expect(screen.getByText('常用标签')).toBeInTheDocument()
  })

  it('displays current patient tags', () => {
    render(<PatientTagManager {...mockProps} />)

    expect(screen.getByText('高血压')).toBeInTheDocument()
    expect(screen.getByText('糖尿病')).toBeInTheDocument()
  })

  it('allows adding new tag', async () => {
    render(<PatientTagManager {...mockProps} />)

    const input = screen.getByPlaceholderText('输入新标签名称')
    const addButton = screen.getByText('添加')

    fireEvent.change(input, { target: { value: '新标签' } })
    fireEvent.click(addButton)

    // The new tag should be added to the current tags
    await waitFor(() => {
      expect(screen.getAllByText('新标签')).toHaveLength(1)
    })
  })

  it('allows adding tag by pressing Enter', async () => {
    render(<PatientTagManager {...mockProps} />)

    const input = screen.getByPlaceholderText('输入新标签名称')

    fireEvent.change(input, { target: { value: '回车标签' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getAllByText('回车标签')).toHaveLength(1)
    })
  })

  it('displays usage instructions', () => {
    render(<PatientTagManager {...mockProps} />)

    expect(screen.getByText('标签使用说明')).toBeInTheDocument()
    expect(screen.getByText('标签用于快速分类和筛选患者')).toBeInTheDocument()
    expect(
      screen.getByText('可以添加疾病、症状、特殊情况等标签')
    ).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(<PatientTagManager {...mockProps} visible={false} />)

    expect(screen.queryByText('管理标签 - 李小明')).not.toBeInTheDocument()
  })

  it('disables add button when input is empty', () => {
    render(<PatientTagManager {...mockProps} />)

    const addButton = screen.getByText('添加')
    expect(addButton.closest('button')).toBeDisabled()
  })

  it('enables add button when input has value', () => {
    render(<PatientTagManager {...mockProps} />)

    const input = screen.getByPlaceholderText('输入新标签名称')
    fireEvent.change(input, { target: { value: '新标签' } })

    const addButton = screen.getByText('添加')
    expect(addButton.closest('button')).not.toBeDisabled()
  })
})
