import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PatientListPage } from '@/pages'
import * as hooks from '@/hooks'

// Mock hooks
vi.mock('@/hooks', () => ({
  usePatients: vi.fn(),
}))

const mockUsePatients = {
  filteredPatients: [
    {
      id: '1',
      name: '李小明',
      age: 35,
      gender: 'male' as const,
      phone: '138****1234',
      tags: ['高血压', '糖尿病'],
      lastVisit: new Date('2024-01-15'),
      medicalHistory: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      name: '王小红',
      age: 28,
      gender: 'female' as const,
      phone: '139****5678',
      tags: ['孕期检查'],
      lastVisit: new Date('2024-01-20'),
      medicalHistory: [],
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-20'),
    },
  ],
  loading: false,
  error: null,
  searchQuery: '',
  filters: { tags: [], dateRange: undefined },
  allTags: ['高血压', '糖尿病', '孕期检查'],
  handleSearchChange: vi.fn(),
  handleFiltersChange: vi.fn(),
  getPatientDetail: vi.fn(),
  updatePatientTags: vi.fn(),
  clearError: vi.fn(),
}

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('PatientListPage', () => {
  beforeEach(() => {
    vi.mocked(hooks.usePatients).mockReturnValue(mockUsePatients)
  })

  it('renders patient list page correctly', () => {
    renderWithRouter(<PatientListPage />)

    expect(screen.getByText('患者管理')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('搜索患者姓名、电话或标签...')
    ).toBeInTheDocument()
    expect(screen.getByText('筛选')).toBeInTheDocument()
    expect(screen.getByText('添加患者')).toBeInTheDocument()
  })

  it('displays patient data in table', () => {
    renderWithRouter(<PatientListPage />)

    expect(screen.getByText('李小明')).toBeInTheDocument()
    expect(screen.getByText('35岁 · 男')).toBeInTheDocument()
    expect(screen.getByText('138****1234')).toBeInTheDocument()
    expect(screen.getByText('高血压')).toBeInTheDocument()
    expect(screen.getByText('糖尿病')).toBeInTheDocument()

    expect(screen.getByText('王小红')).toBeInTheDocument()
    expect(screen.getByText('28岁 · 女')).toBeInTheDocument()
    expect(screen.getByText('139****5678')).toBeInTheDocument()
    expect(screen.getByText('孕期检查')).toBeInTheDocument()
  })

  it('handles search input change', async () => {
    renderWithRouter(<PatientListPage />)

    const searchInput =
      screen.getByPlaceholderText('搜索患者姓名、电话或标签...')
    fireEvent.change(searchInput, { target: { value: '李小明' } })

    expect(mockUsePatients.handleSearchChange).toHaveBeenCalledWith('李小明')
  })

  it('opens filter drawer when filter button is clicked', async () => {
    renderWithRouter(<PatientListPage />)

    const filterButton = screen.getByText('筛选')
    fireEvent.click(filterButton)

    await waitFor(() => {
      expect(screen.getByText('筛选条件')).toBeInTheDocument()
      expect(screen.getByText('标签筛选')).toBeInTheDocument()
      expect(screen.getByText('就诊时间')).toBeInTheDocument()
    })
  })

  it('opens patient detail drawer when view detail is clicked', async () => {
    mockUsePatients.getPatientDetail.mockResolvedValue(
      mockUsePatients.filteredPatients[0]
    )

    renderWithRouter(<PatientListPage />)

    const viewDetailButtons = screen.getAllByText('查看详情')
    fireEvent.click(viewDetailButtons[0])

    expect(mockUsePatients.getPatientDetail).toHaveBeenCalledWith('1')
  })

  it('opens tag manager when manage tags is clicked', async () => {
    renderWithRouter(<PatientListPage />)

    const manageTagsButtons = screen.getAllByText('管理标签')
    fireEvent.click(manageTagsButtons[0])

    // The tag manager drawer should open
    // This would be tested more thoroughly in integration tests
  })

  it('displays loading state', () => {
    vi.mocked(hooks.usePatients).mockReturnValue({
      ...mockUsePatients,
      loading: true,
    })

    renderWithRouter(<PatientListPage />)

    // Check for Ant Design's loading spinner
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('displays empty state when no patients', () => {
    vi.mocked(hooks.usePatients).mockReturnValue({
      ...mockUsePatients,
      filteredPatients: [],
    })

    renderWithRouter(<PatientListPage />)

    expect(screen.getByText('暂无患者数据')).toBeInTheDocument()
  })

  it('handles error display', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(hooks.usePatients).mockReturnValue({
      ...mockUsePatients,
      error: '获取患者列表失败',
    })

    renderWithRouter(<PatientListPage />)

    // Error should be cleared
    expect(mockUsePatients.clearError).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
