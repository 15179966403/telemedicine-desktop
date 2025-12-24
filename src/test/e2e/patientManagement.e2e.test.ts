/**
 * 患者管理功能端到端测试
 * Patient Management End-to-End Tests
 *
 * 需求覆盖: 2.1-2.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import PatientListPage from '@/pages/PatientListPage'
import { usePatientStore } from '@/stores/patientStore'
import type { Patient } from '@/types'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockPatients: Patient[] = [
  {
    id: 'patient-001',
    name: '张三',
    age: 35,
    gender: 'male',
    phone: '13800138001',
    tags: ['高血压', '糖尿病'],
    lastVisit: new Date('2024-01-15T10:00:00Z'),
    medicalHistory: [
      {
        id: 'record-001',
        date: new Date('2024-01-15T10:00:00Z'),
        diagnosis: '高血压',
        treatment: '降压药',
        doctor: '李医生',
      },
    ],
  },
  {
    id: 'patient-002',
    name: '李四',
    age: 28,
    gender: 'female',
    phone: '13800138002',
    tags: ['感冒'],
    lastVisit: new Date('2024-01-16T14:00:00Z'),
    medicalHistory: [],
  },
  {
    id: 'patient-003',
    name: '王五',
    age: 45,
    gender: 'male',
    phone: '13800138003',
    tags: ['高血压', '冠心病'],
    lastVisit: new Date('2024-01-14T09:00:00Z'),
    medicalHistory: [],
  },
]

describe('患者管理功能端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset patient store
    usePatientStore.setState({
      patients: [],
      selectedPatient: null,
      searchQuery: '',
      filters: {},
      loading: false,
    })
  })

  describe('需求 2.1 - 患者列表显示', () => {
    it('应该显示所有关联的患者信息', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      // 验证调用了获取患者列表的API
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_patient_list', expect.any(Object))
      })

      // 验证患者列表显示
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.getByText('李四')).toBeInTheDocument()
        expect(screen.getByText('王五')).toBeInTheDocument()
      })

      // 验证患者基本信息显示
      expect(screen.getByText(/35/)).toBeInTheDocument() // 张三的年龄
      expect(screen.getByText(/28/)).toBeInTheDocument() // 李四的年龄
      expect(screen.getByText(/45/)).toBeInTheDocument() // 王五的年龄
    })

    it('应该显示患者的标签信息', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('高血压')).toBeInTheDocument()
        expect(screen.getByText('糖尿病')).toBeInTheDocument()
        expect(screen.getByText('感冒')).toBeInTheDocument()
        expect(screen.getByText('冠心病')).toBeInTheDocument()
      })
    })
  })

  describe('需求 2.2 - 患者搜索功能', () => {
    it('应该支持按姓名搜索患者', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      // Initial load
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      // Search result
      vi.mocked(invoke).mockResolvedValueOnce([mockPatients[0]])

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      // 等待初始加载
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 输入搜索关键词
      const searchInput = screen.getByPlaceholderText(/搜索患者|搜索/i)
      await user.type(searchInput, '张三')

      // 验证搜索请求
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('search_patients', {
          query: expect.objectContaining({
            keyword: '张三',
          }),
        })
      })

      // 验证搜索结果
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.queryByText('李四')).not.toBeInTheDocument()
        expect(screen.queryByText('王五')).not.toBeInTheDocument()
      })
    })

    it('应该支持按病情搜索患者', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce([mockPatients[0], mockPatients[2]])

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 搜索高血压患者
      const searchInput = screen.getByPlaceholderText(/搜索患者|搜索/i)
      await user.type(searchInput, '高血压')

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('search_patients', {
          query: expect.objectContaining({
            keyword: '高血压',
          }),
        })
      })

      // 验证返回了两个高血压患者
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.getByText('王五')).toBeInTheDocument()
        expect(screen.queryByText('李四')).not.toBeInTheDocument()
      })
    })

    it('应该支持按就诊时间筛选患者', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce([mockPatients[1]])

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 打开筛选器
      const filterButton = screen.getByRole('button', { name: /筛选|过滤/i })
      await user.click(filterButton)

      // 选择日期范围
      const dateRangePicker = screen.getByLabelText(/就诊时间|日期/i)
      await user.click(dateRangePicker)

      // 验证筛选请求
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('search_patients', {
          query: expect.objectContaining({
            dateRange: expect.any(Object),
          }),
        })
      })
    })
  })

  describe('需求 2.3 - 患者详情查看', () => {
    it('应该显示患者的历史病历', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 点击患者查看详情
      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 验证获取患者详情
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_patient_detail', {
          patientId: 'patient-001',
        })
      })

      // 验证显示历史病历
      await waitFor(() => {
        expect(screen.getByText(/高血压/)).toBeInTheDocument()
        expect(screen.getByText(/降压药/)).toBeInTheDocument()
        expect(screen.getByText(/李医生/)).toBeInTheDocument()
      })
    })

    it('应该显示患者的检查报告', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const patientWithReports = {
        ...mockPatients[0],
        reports: [
          {
            id: 'report-001',
            type: '血常规',
            date: new Date('2024-01-15T10:00:00Z'),
            result: '正常',
            fileUrl: '/reports/report-001.pdf',
          },
        ],
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(patientWithReports)

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 切换到检查报告标签
      const reportsTab = screen.getByRole('tab', { name: /检查报告|报告/i })
      await user.click(reportsTab)

      // 验证显示检查报告
      await waitFor(() => {
        expect(screen.getByText(/血常规/)).toBeInTheDocument()
        expect(screen.getByText(/正常/)).toBeInTheDocument()
      })
    })

    it('应该显示患者的用药记录', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      const patientWithMedications = {
        ...mockPatients[0],
        medications: [
          {
            id: 'med-001',
            name: '阿司匹林',
            dosage: '100mg',
            frequency: '每日一次',
            startDate: new Date('2024-01-01T00:00:00Z'),
            endDate: new Date('2024-01-31T00:00:00Z'),
          },
        ],
      }

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(patientWithMedications)

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 切换到用药记录标签
      const medicationsTab = screen.getByRole('tab', { name: /用药记录|用药/i })
      await user.click(medicationsTab)

      // 验证显示用药记录
      await waitFor(() => {
        expect(screen.getByText(/阿司匹林/)).toBeInTheDocument()
        expect(screen.getByText(/100mg/)).toBeInTheDocument()
        expect(screen.getByText(/每日一次/)).toBeInTheDocument()
      })
    })
  })

  describe('需求 2.4 - 患者标签管理', () => {
    it('应该允许为患者添加标签', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 打开患者详情
      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 点击添加标签按钮
      const addTagButton = screen.getByRole('button', { name: /添加标签|新增标签/i })
      await user.click(addTagButton)

      // 输入新标签
      const tagInput = screen.getByPlaceholderText(/输入标签|标签名称/i)
      await user.type(tagInput, '慢性病')

      // 确认添加
      const confirmButton = screen.getByRole('button', { name: /确定|确认/i })
      await user.click(confirmButton)

      // 验证调用了更新标签的API
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('update_patient_tags', {
          patientId: 'patient-001',
          tags: expect.arrayContaining(['高血压', '糖尿病', '慢性病']),
        })
      })
    })

    it('应该允许删除患者标签', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 找到标签并点击删除按钮
      const diabetesTag = screen.getByText('糖尿病').closest('.ant-tag') || screen.getByText('糖尿病').parentElement
      const deleteButton = within(diabetesTag!).getByRole('button') || within(diabetesTag!).getByLabelText(/删除|关闭/i)
      await user.click(deleteButton)

      // 验证调用了更新标签的API
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('update_patient_tags', {
          patientId: 'patient-001',
          tags: ['高血压'], // 糖尿病标签已删除
        })
      })
    })

    it('应该支持按标签筛选患者', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce([mockPatients[0], mockPatients[2]])

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 点击标签筛选
      const tagFilter = screen.getByText('高血压')
      await user.click(tagFilter)

      // 验证筛选请求
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('search_patients', {
          query: expect.objectContaining({
            tags: ['高血压'],
          }),
        })
      })

      // 验证筛选结果
      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.getByText('王五')).toBeInTheDocument()
        expect(screen.queryByText('李四')).not.toBeInTheDocument()
      })
    })
  })

  describe('需求 2.5 - 随访功能', () => {
    it('应该支持发送复诊提醒', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 点击发送复诊提醒按钮
      const reminderButton = screen.getByRole('button', { name: /复诊提醒|发送提醒/i })
      await user.click(reminderButton)

      // 选择提醒时间
      const dateInput = screen.getByLabelText(/提醒时间|复诊时间/i)
      await user.click(dateInput)

      // 输入提醒内容
      const contentInput = screen.getByPlaceholderText(/提醒内容|输入内容/i)
      await user.type(contentInput, '请按时复诊，检查血压情况')

      // 确认发送
      const sendButton = screen.getByRole('button', { name: /发送|确认/i })
      await user.click(sendButton)

      // 验证调用了发送提醒的API
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('send_follow_up_reminder', {
          patientId: 'patient-001',
          content: '请按时复诊，检查血压情况',
          reminderDate: expect.any(String),
        })
      })
    })

    it('应该支持发送健康指导', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      // 点击发送健康指导按钮
      const guidanceButton = screen.getByRole('button', { name: /健康指导|发送指导/i })
      await user.click(guidanceButton)

      // 输入健康指导内容
      const contentInput = screen.getByPlaceholderText(/指导内容|输入内容/i)
      await user.type(contentInput, '注意控制饮食，少盐少油，适量运动')

      // 确认发送
      const sendButton = screen.getByRole('button', { name: /发送|确认/i })
      await user.click(sendButton)

      // 验证调用了发送健康指导的API
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('send_health_guidance', {
          patientId: 'patient-001',
          content: '注意控制饮食，少盐少油，适量运动',
        })
      })
    })
  })

  describe('完整患者管理流程集成测试', () => {
    it('应该完成从搜索患者到查看详情并添加标签的完整流程', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      // 步骤1: 加载患者列表
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients)

      render(
        <BrowserRouter>
          <PatientListPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
      })

      // 步骤2: 搜索患者
      vi.mocked(invoke).mockResolvedValueOnce([mockPatients[0]])

      const searchInput = screen.getByPlaceholderText(/搜索患者|搜索/i)
      await user.type(searchInput, '张三')

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('search_patients', expect.any(Object))
      })

      // 步骤3: 查看患者详情
      vi.mocked(invoke).mockResolvedValueOnce(mockPatients[0])

      const patientCard = screen.getByText('张三').closest('[role="listitem"]') || screen.getByText('张三').closest('div')
      await user.click(patientCard!)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_patient_detail', {
          patientId: 'patient-001',
        })
      })

      // 步骤4: 添加标签
      vi.mocked(invoke).mockResolvedValueOnce({ success: true })

      const addTagButton = screen.getByRole('button', { name: /添加标签|新增标签/i })
      await user.click(addTagButton)

      const tagInput = screen.getByPlaceholderText(/输入标签|标签名称/i)
      await user.type(tagInput, '重点关注')

      const confirmButton = screen.getByRole('button', { name: /确定|确认/i })
      await user.click(confirmButton)

      // 步骤5: 验证标签添加成功
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('update_patient_tags', {
          patientId: 'patient-001',
          tags: expect.arrayContaining(['重点关注']),
        })
      })
    })
  })
})
