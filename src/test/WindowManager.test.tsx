/**
 * WindowManager 组件测试
 * WindowManager Component Tests
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WindowManager } from '@/components/WindowManager'
import { useWindowStore } from '@/stores/windowStore'
import type { WindowInfo, ResourceUsage } from '@/types'

// Mock the window store
vi.mock('@/stores/windowStore')

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock Tauri events
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}))

const mockWindowStore = {
  getAllWindows: vi.fn(),
  closeWindow: vi.fn(),
  focusWindow: vi.fn(),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  getResourceUsage: vi.fn(),
}

describe('WindowManager 组件测试', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useWindowStore as any).mockReturnValue(mockWindowStore)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockWindows: WindowInfo[] = [
    {
      id: 'main-window',
      type: 'main',
      title: '互联网医院 - 工作台',
      url: '/',
      data: {},
      position: { x: 0, y: 0 },
      size: { width: 1200, height: 800 },
      state: 'normal',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      lastFocused: new Date('2024-01-01T10:30:00Z'),
    },
    {
      id: 'consultation-window',
      type: 'consultation',
      title: '问诊 - 张三',
      url: '/consultation/123',
      data: { consultationId: '123', patientName: '张三' },
      position: { x: 100, y: 100 },
      size: { width: 800, height: 600 },
      state: 'normal',
      createdAt: new Date('2024-01-01T10:15:00Z'),
      lastFocused: new Date('2024-01-01T10:45:00Z'),
    },
    {
      id: 'patient-window',
      type: 'patient_detail',
      title: '患者详情 - 李四',
      url: '/patient/456',
      data: { patientId: '456', patientName: '李四' },
      position: { x: 200, y: 150 },
      size: { width: 900, height: 700 },
      state: 'maximized',
      createdAt: new Date('2024-01-01T10:20:00Z'),
      lastFocused: new Date('2024-01-01T10:40:00Z'),
    },
  ]

  const mockResourceUsage: ResourceUsage = {
    memoryUsage: 256,
    windowCount: 3,
    consultationWindowCount: 1,
    lastUpdated: new Date('2024-01-01T10:45:00Z'),
  }

  it('应该正确渲染窗口管理器', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    // 检查标题
    expect(screen.getByText('窗口管理器')).toBeInTheDocument()

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('3 个窗口')).toBeInTheDocument()
    })

    // 检查资源使用情况
    expect(screen.getByText('资源使用情况')).toBeInTheDocument()
    expect(screen.getByText('256MB')).toBeInTheDocument()

    // 检查窗口列表
    expect(screen.getByText('互联网医院 - 工作台')).toBeInTheDocument()
    expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    expect(screen.getByText('患者详情 - 李四')).toBeInTheDocument()
  })

  it('应该显示正确的窗口类型标签', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('工作台')).toBeInTheDocument()
      expect(screen.getByText('问诊')).toBeInTheDocument()
      expect(screen.getByText('患者详情')).toBeInTheDocument()
    })
  })

  it('应该显示正确的窗口状态标签', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      const normalTags = screen.getAllByText('正常')
      expect(normalTags).toHaveLength(2) // main 和 consultation 窗口

      expect(screen.getByText('最大化')).toBeInTheDocument() // patient 窗口
    })
  })

  it('应该能够聚焦窗口', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)
    mockWindowStore.focusWindow.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(<WindowManager visible={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    })

    // 点击聚焦按钮
    const focusButtons = screen.getAllByLabelText('聚焦窗口')
    await user.click(focusButtons[1]) // 点击问诊窗口的聚焦按钮

    expect(mockWindowStore.focusWindow).toHaveBeenCalledWith(
      'consultation-window'
    )
    expect(onClose).toHaveBeenCalled() // 聚焦后应该关闭窗口管理器
  })

  it('应该能够最小化窗口', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)
    mockWindowStore.minimizeWindow.mockResolvedValue(undefined)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    })

    // 点击最小化按钮
    const minimizeButtons = screen.getAllByLabelText('最小化')
    await user.click(minimizeButtons[1]) // 点击问诊窗口的最小化按钮

    expect(mockWindowStore.minimizeWindow).toHaveBeenCalledWith(
      'consultation-window'
    )
  })

  it('应该能够最大化窗口', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)
    mockWindowStore.maximizeWindow.mockResolvedValue(undefined)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    })

    // 点击最大化按钮
    const maximizeButtons = screen.getAllByLabelText('最大化')
    await user.click(maximizeButtons[1]) // 点击问诊窗口的最大化按钮

    expect(mockWindowStore.maximizeWindow).toHaveBeenCalledWith(
      'consultation-window'
    )
  })

  it('应该能够关闭窗口（除了主窗口）', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)
    mockWindowStore.closeWindow.mockResolvedValue(undefined)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    })

    // 获取所有关闭按钮
    const closeButtons = screen.getAllByLabelText('关闭窗口')

    // 主窗口的关闭按钮应该被禁用
    expect(closeButtons[0]).toBeDisabled()

    // 问诊窗口的关闭按钮应该可用
    expect(closeButtons[1]).not.toBeDisabled()

    // 点击问诊窗口的关闭按钮
    await user.click(closeButtons[1])

    expect(mockWindowStore.closeWindow).toHaveBeenCalledWith(
      'consultation-window'
    )
  })

  it('应该显示内存使用警告', async () => {
    const highMemoryUsage: ResourceUsage = {
      memoryUsage: 450, // 接近512MB限制
      windowCount: 7,
      consultationWindowCount: 1,
      lastUpdated: new Date(),
    }

    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(highMemoryUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(
        screen.getByText(
          '当前窗口数量较多，可能影响系统性能。建议关闭不必要的窗口。'
        )
      ).toBeInTheDocument()
    })
  })

  it('应该正确显示内存使用进度条', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      // 256MB / 512MB = 50%
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(screen.getByText('256MB')).toBeInTheDocument()
    })
  })

  it('应该显示窗口数据标签', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      // 检查问诊窗口的数据标签
      expect(screen.getByText('consultationId: 123')).toBeInTheDocument()
      expect(screen.getByText('patientName: 张三')).toBeInTheDocument()

      // 检查患者详情窗口的数据标签
      expect(screen.getByText('patientId: 456')).toBeInTheDocument()
      expect(screen.getByText('patientName: 李四')).toBeInTheDocument()
    })
  })

  it('应该能够刷新窗口数据', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue(mockWindows)
    mockWindowStore.getResourceUsage.mockResolvedValue(mockResourceUsage)

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
    })

    // 点击刷新按钮
    const refreshButton = screen.getByText('刷新')
    await user.click(refreshButton)

    // 应该再次调用获取数据的方法
    expect(mockWindowStore.getAllWindows).toHaveBeenCalledTimes(2)
    expect(mockWindowStore.getResourceUsage).toHaveBeenCalledTimes(2)
  })

  it('应该在窗口不可见时不加载数据', () => {
    render(<WindowManager visible={false} onClose={() => {}} />)

    // 不应该调用数据获取方法
    expect(mockWindowStore.getAllWindows).not.toHaveBeenCalled()
    expect(mockWindowStore.getResourceUsage).not.toHaveBeenCalled()
  })

  it('应该处理加载状态', async () => {
    // 模拟加载延迟
    mockWindowStore.getAllWindows.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWindows), 100))
    )
    mockWindowStore.getResourceUsage.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve(mockResourceUsage), 100)
        )
    )

    render(<WindowManager visible={true} onClose={() => {}} />)

    // 应该显示加载状态
    expect(screen.getByRole('list')).toHaveClass('ant-list-loading')

    // 等待加载完成
    await waitFor(
      () => {
        expect(screen.getByText('问诊 - 张三')).toBeInTheDocument()
      },
      { timeout: 200 }
    )
  })

  it('应该显示空状态', async () => {
    mockWindowStore.getAllWindows.mockResolvedValue([])
    mockWindowStore.getResourceUsage.mockResolvedValue({
      memoryUsage: 50,
      windowCount: 0,
      consultationWindowCount: 0,
      lastUpdated: new Date(),
    })

    render(<WindowManager visible={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('暂无活动窗口')).toBeInTheDocument()
    })
  })
})
