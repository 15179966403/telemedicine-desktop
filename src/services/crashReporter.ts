// 崩溃报告服务
import { invoke } from '@tauri-apps/api/core'

export interface CrashReport {
  id: string
  timestamp: string
  error: {
    message: string
    stack?: string
    name: string
  }
  context: {
    url: string
    userAgent: string
    platform: string
    version: string
  }
  systemInfo?: {
    memory?: number
    cpu?: string
  }
  userActions?: string[]
}

export class CrashReporter {
  private static instance: CrashReporter
  private userActions: string[] = []
  private maxActions = 50
  private reportEndpoint =
    'https://crash-reports.telemedicine.example.com/api/reports'

  private constructor() {
    this.setupGlobalErrorHandlers()
  }

  static getInstance(): CrashReporter {
    if (!this.instance) {
      this.instance = new CrashReporter()
    }
    return this.instance
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 捕获未处理的错误
    window.addEventListener('error', event => {
      this.handleError(event.error || new Error(event.message))
    })

    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', event => {
      this.handleError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`)
      )
    })

    // React 错误边界会调用这个方法
    window.addEventListener('react-error', ((event: CustomEvent) => {
      this.handleError(event.detail.error)
    }) as EventListener)
  }

  /**
   * 记录用户操作
   */
  recordAction(action: string): void {
    this.userActions.push(`${new Date().toISOString()}: ${action}`)
    if (this.userActions.length > this.maxActions) {
      this.userActions.shift()
    }
  }

  /**
   * 处理错误
   */
  private async handleError(error: Error): Promise<void> {
    console.error('捕获到错误:', error)

    const report = await this.createCrashReport(error)
    await this.saveCrashReport(report)
    await this.sendCrashReport(report)
  }

  /**
   * 创建崩溃报告
   */
  private async createCrashReport(error: Error): Promise<CrashReport> {
    const packageJson = await this.getPackageInfo()

    return {
      id: this.generateReportId(),
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        version: packageJson.version || 'unknown',
      },
      systemInfo: await this.getSystemInfo(),
      userActions: [...this.userActions],
    }
  }

  /**
   * 生成报告 ID
   */
  private generateReportId(): string {
    return `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取包信息
   */
  private async getPackageInfo(): Promise<{ version: string }> {
    try {
      // 从构建信息中读取版本
      const response = await fetch('/build-info.json')
      return await response.json()
    } catch {
      return { version: 'unknown' }
    }
  }

  /**
   * 获取系统信息
   */
  private async getSystemInfo(): Promise<{
    memory?: number
    cpu?: string
  }> {
    try {
      // 获取内存信息
      const memory = (performance as any).memory?.usedJSHeapSize
      return {
        memory,
        cpu: navigator.hardwareConcurrency
          ? `${navigator.hardwareConcurrency} cores`
          : 'unknown',
      }
    } catch {
      return {}
    }
  }

  /**
   * 保存崩溃报告到本地
   */
  private async saveCrashReport(report: CrashReport): Promise<void> {
    try {
      const reportJson = JSON.stringify(report, null, 2)
      await invoke('save_file_locally', {
        fileData: Array.from(new TextEncoder().encode(reportJson)),
        fileName: `crash-reports/${report.id}.json`,
      })
    } catch (error) {
      console.error('保存崩溃报告失败:', error)
    }
  }

  /**
   * 发送崩溃报告到服务器
   */
  private async sendCrashReport(report: CrashReport): Promise<void> {
    try {
      // 在生产环境中发送报告
      if (import.meta.env.PROD) {
        await fetch(this.reportEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(report),
        })
      }
    } catch (error) {
      console.error('发送崩溃报告失败:', error)
    }
  }

  /**
   * 手动报告错误
   */
  async reportError(
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    const report = await this.createCrashReport(error)
    if (context) {
      report.context = { ...report.context, ...context }
    }
    await this.saveCrashReport(report)
    await this.sendCrashReport(report)
  }

  /**
   * 获取本地崩溃报告列表
   */
  async getLocalCrashReports(): Promise<string[]> {
    try {
      // 这里需要实现获取本地崩溃报告列表的逻辑
      return []
    } catch (error) {
      console.error('获取崩溃报告列表失败:', error)
      return []
    }
  }

  /**
   * 清理旧的崩溃报告
   */
  async cleanupOldReports(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      // 这里需要实现清理逻辑
    } catch (error) {
      console.error('清理崩溃报告失败:', error)
    }
  }
}

// 初始化崩溃报告器
export const crashReporter = CrashReporter.getInstance()
