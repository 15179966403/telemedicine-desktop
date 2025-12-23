/**
 * 窗口资源管理服务
 * Window Resource Management Service
 */

import { invoke } from '@tauri-apps/api/core'
import type { ResourceUsage, WindowLimits, WindowInfo } from '@/types'
import {
  windowCommunicationService,
  MESSAGE_TYPES,
} from './windowCommunication'

export interface WindowResourceManager {
  // 检查资源使用情况
  checkResourceUsage(): Promise<ResourceUsage>

  // 检查是否可以创建新窗口
  canCreateWindow(windowType: string): Promise<boolean>

  // 获取窗口限制配置
  getWindowLimits(): Promise<WindowLimits>

  // 更新窗口限制配置
  updateWindowLimits(limits: Partial<WindowLimits>): Promise<void>

  // 强制关闭最旧的窗口以释放资源
  forceCloseOldestWindow(): Promise<string | null>

  // 监控资源使用情况
  startResourceMonitoring(): void

  // 停止资源监控
  stopResourceMonitoring(): void

  // 获取窗口优先级（用于决定关闭顺序）
  getWindowPriority(window: WindowInfo): number
}

class WindowResourceManagerImpl implements WindowResourceManager {
  private monitoringInterval: NodeJS.Timeout | null = null
  private readonly MONITORING_INTERVAL = 30000 // 30秒检查一次
  private readonly WARNING_THRESHOLD = 0.8 // 80%资源使用率警告
  private readonly CRITICAL_THRESHOLD = 0.95 // 95%资源使用率严重警告

  private defaultLimits: WindowLimits = {
    maxWindows: 8,
    maxConsultationWindows: 5,
    memoryThreshold: 512, // MB
    cpuThreshold: 80, // percentage
  }

  async checkResourceUsage(): Promise<ResourceUsage> {
    try {
      const usage = await invoke<ResourceUsage>('get_resource_usage')

      // 检查是否需要发出警告
      await this.checkResourceWarnings(usage)

      return usage
    } catch (error) {
      console.error('Failed to check resource usage:', error)
      throw error
    }
  }

  async canCreateWindow(windowType: string): Promise<boolean> {
    try {
      const [usage, limits] = await Promise.all([
        this.checkResourceUsage(),
        this.getWindowLimits(),
      ])

      // 检查总窗口数量限制
      if (usage.windowCount >= limits.maxWindows) {
        return false
      }

      // 检查特定类型窗口限制
      if (
        windowType === 'consultation' &&
        usage.consultationWindowCount >= limits.maxConsultationWindows
      ) {
        return false
      }

      // 检查内存使用限制
      if (usage.memoryUsage >= limits.memoryThreshold) {
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to check if can create window:', error)
      return false
    }
  }

  async getWindowLimits(): Promise<WindowLimits> {
    try {
      // 从本地存储获取用户自定义限制
      const stored = localStorage.getItem('window-limits')
      if (stored) {
        const customLimits = JSON.parse(stored) as Partial<WindowLimits>
        return { ...this.defaultLimits, ...customLimits }
      }

      return this.defaultLimits
    } catch (error) {
      console.error('Failed to get window limits:', error)
      return this.defaultLimits
    }
  }

  async updateWindowLimits(limits: Partial<WindowLimits>): Promise<void> {
    try {
      const currentLimits = await this.getWindowLimits()
      const updatedLimits = { ...currentLimits, ...limits }

      // 验证限制值的合理性
      if (updatedLimits.maxWindows < 1 || updatedLimits.maxWindows > 20) {
        throw new Error('最大窗口数量必须在1-20之间')
      }

      if (
        updatedLimits.maxConsultationWindows < 1 ||
        updatedLimits.maxConsultationWindows > updatedLimits.maxWindows
      ) {
        throw new Error('最大问诊窗口数量必须在1到最大窗口数量之间')
      }

      if (
        updatedLimits.memoryThreshold < 100 ||
        updatedLimits.memoryThreshold > 2048
      ) {
        throw new Error('内存阈值必须在100MB-2048MB之间')
      }

      // 保存到本地存储
      localStorage.setItem('window-limits', JSON.stringify(updatedLimits))

      // 通知其他窗口限制已更新
      await windowCommunicationService.broadcastMessage(
        MESSAGE_TYPES.DATA_SYNC,
        {
          dataType: 'window-limits',
          data: updatedLimits,
        }
      )
    } catch (error) {
      console.error('Failed to update window limits:', error)
      throw error
    }
  }

  async forceCloseOldestWindow(): Promise<string | null> {
    try {
      const windows = await invoke<WindowInfo[]>('get_all_windows')

      if (windows.length === 0) {
        return null
      }

      // 过滤掉主窗口（不能关闭）
      const closableWindows = windows.filter(w => w.type !== 'main')

      if (closableWindows.length === 0) {
        return null
      }

      // 按优先级和创建时间排序，优先关闭优先级低且创建时间早的窗口
      closableWindows.sort((a, b) => {
        const priorityDiff =
          this.getWindowPriority(a) - this.getWindowPriority(b)
        if (priorityDiff !== 0) {
          return priorityDiff
        }

        // 优先级相同时，关闭创建时间更早的窗口
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      const windowToClose = closableWindows[0]

      // 关闭窗口
      await invoke('close_window_by_id', { windowId: windowToClose.id })

      // 通知用户
      await windowCommunicationService.broadcastMessage(
        MESSAGE_TYPES.NOTIFICATION,
        {
          title: '资源管理',
          message: `由于资源不足，已自动关闭窗口: ${windowToClose.title}`,
          type: 'warning',
        }
      )

      return windowToClose.id
    } catch (error) {
      console.error('Failed to force close oldest window:', error)
      return null
    }
  }

  getWindowPriority(window: WindowInfo): number {
    // 窗口优先级（数字越小优先级越高，越不容易被关闭）
    const priorityMap = {
      main: 0, // 主窗口，最高优先级，不能关闭
      consultation: 1, // 问诊窗口，高优先级
      patient_detail: 2, // 患者详情，中等优先级
      settings: 3, // 设置窗口，低优先级
      notification: 4, // 通知窗口，最低优先级
    }

    const basePriority =
      priorityMap[window.type as keyof typeof priorityMap] || 5

    // 根据最后聚焦时间调整优先级（最近使用的窗口优先级更高）
    const lastFocusedTime = new Date(window.lastFocused).getTime()
    const now = Date.now()
    const hoursSinceLastFocus = (now - lastFocusedTime) / (1000 * 60 * 60)

    // 每小时未使用增加0.1的优先级值（降低优先级）
    const timeAdjustment = Math.min(hoursSinceLastFocus * 0.1, 2)

    return basePriority + timeAdjustment
  }

  startResourceMonitoring(): void {
    if (this.monitoringInterval) {
      return // 已经在监控中
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkResourceUsage()
      } catch (error) {
        console.error('Resource monitoring error:', error)
      }
    }, this.MONITORING_INTERVAL)

    console.log('Window resource monitoring started')
  }

  stopResourceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('Window resource monitoring stopped')
    }
  }

  private async checkResourceWarnings(usage: ResourceUsage): Promise<void> {
    const limits = await this.getWindowLimits()

    // 检查内存使用警告
    const memoryUsageRatio = usage.memoryUsage / limits.memoryThreshold
    if (memoryUsageRatio >= this.CRITICAL_THRESHOLD) {
      await windowCommunicationService.broadcastMessage(MESSAGE_TYPES.ALERT, {
        title: '严重警告：内存使用过高',
        message: `当前内存使用 ${usage.memoryUsage}MB，已达到限制的 ${Math.round(memoryUsageRatio * 100)}%。建议立即关闭不必要的窗口。`,
        type: 'error',
      })

      // 自动关闭最旧的窗口
      await this.forceCloseOldestWindow()
    } else if (memoryUsageRatio >= this.WARNING_THRESHOLD) {
      await windowCommunicationService.broadcastMessage(
        MESSAGE_TYPES.NOTIFICATION,
        {
          title: '警告：内存使用较高',
          message: `当前内存使用 ${usage.memoryUsage}MB，已达到限制的 ${Math.round(memoryUsageRatio * 100)}%。建议关闭不必要的窗口。`,
          type: 'warning',
        }
      )
    }

    // 检查窗口数量警告
    const windowCountRatio = usage.windowCount / limits.maxWindows
    if (windowCountRatio >= this.WARNING_THRESHOLD) {
      await windowCommunicationService.broadcastMessage(
        MESSAGE_TYPES.NOTIFICATION,
        {
          title: '提示：窗口数量较多',
          message: `当前已打开 ${usage.windowCount} 个窗口，接近最大限制 ${limits.maxWindows}。建议关闭不必要的窗口以提高性能。`,
          type: 'info',
        }
      )
    }
  }
}

// 创建单例实例
export const windowResourceManager = new WindowResourceManagerImpl()

// React Hook for resource management
export const useWindowResourceManager = () => {
  const checkResourceUsage = windowResourceManager.checkResourceUsage.bind(
    windowResourceManager
  )
  const canCreateWindow = windowResourceManager.canCreateWindow.bind(
    windowResourceManager
  )
  const getWindowLimits = windowResourceManager.getWindowLimits.bind(
    windowResourceManager
  )
  const updateWindowLimits = windowResourceManager.updateWindowLimits.bind(
    windowResourceManager
  )
  const forceCloseOldestWindow =
    windowResourceManager.forceCloseOldestWindow.bind(windowResourceManager)
  const startResourceMonitoring =
    windowResourceManager.startResourceMonitoring.bind(windowResourceManager)
  const stopResourceMonitoring =
    windowResourceManager.stopResourceMonitoring.bind(windowResourceManager)

  return {
    checkResourceUsage,
    canCreateWindow,
    getWindowLimits,
    updateWindowLimits,
    forceCloseOldestWindow,
    startResourceMonitoring,
    stopResourceMonitoring,
  }
}
