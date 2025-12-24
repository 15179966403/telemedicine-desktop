/**
 * 网络状态检测服务
 * Network status detection service
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// 网络状态类型
export type NetworkStatus = 'online' | 'offline' | 'slow' | 'unstable'

// 网络连接信息
export interface NetworkInfo {
  status: NetworkStatus
  type?: 'wifi' | 'ethernet' | 'cellular' | 'unknown'
  speed?: number // Mbps
  latency?: number // ms
  lastChecked: Date
}

// 网络状态变化回调
export type NetworkStatusCallback = (
  status: NetworkStatus,
  info: NetworkInfo
) => void

// 网络检测配置
export interface NetworkDetectionConfig {
  checkInterval: number // ms
  timeoutDuration: number // ms
  slowThreshold: number // ms
  unstableThreshold: number // consecutive failures
  testUrls: string[]
}

export class NetworkStatusService {
  private static instance: NetworkStatusService
  private currentStatus: NetworkStatus = 'online'
  private networkInfo: NetworkInfo
  private callbacks: NetworkStatusCallback[] = []
  private checkTimer?: NodeJS.Timeout
  private config: NetworkDetectionConfig
  private consecutiveFailures = 0
  private isInitialized = false

  constructor() {
    this.config = {
      checkInterval: 10000, // 10 seconds
      timeoutDuration: 5000, // 5 seconds
      slowThreshold: 3000, // 3 seconds
      unstableThreshold: 3, // 3 consecutive failures
      testUrls: [
        'https://api.telemedicine.com/health',
        'https://www.google.com/generate_204',
        'https://www.baidu.com',
      ],
    }

    this.networkInfo = {
      status: 'online',
      lastChecked: new Date(),
    }
  }

  static getInstance(): NetworkStatusService {
    if (!NetworkStatusService.instance) {
      NetworkStatusService.instance = new NetworkStatusService()
    }
    return NetworkStatusService.instance
  }

  // 初始化网络状态服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 设置浏览器网络状态监听
      this.setupBrowserNetworkListeners()

      // 设置 Tauri 网络状态监听
      await this.setupTauriNetworkListeners()

      // 执行初始网络检测
      await this.checkNetworkStatus()

      // 启动定期检测
      this.startPeriodicCheck()

      this.isInitialized = true
      console.log('Network status service initialized')
    } catch (error) {
      console.error('Failed to initialize network status service:', error)
      throw error
    }
  }

  // 销毁服务
  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }

    // 移除浏览器事件监听器
    window.removeEventListener('online', this.handleBrowserOnline)
    window.removeEventListener('offline', this.handleBrowserOffline)

    this.callbacks = []
    this.isInitialized = false
    console.log('Network status service destroyed')
  }

  // 获取当前网络状态
  getCurrentStatus(): NetworkStatus {
    return this.currentStatus
  }

  // 获取网络信息
  getNetworkInfo(): NetworkInfo {
    return { ...this.networkInfo }
  }

  // 添加状态变化监听器
  addStatusListener(callback: NetworkStatusCallback): () => void {
    this.callbacks.push(callback)

    // 立即调用一次回调，提供当前状态
    callback(this.currentStatus, this.networkInfo)

    // 返回移除监听器的函数
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  // 手动检测网络状态
  async checkNetworkStatus(): Promise<NetworkInfo> {
    try {
      console.log('Checking network status...')

      // 首先检查浏览器的 navigator.onLine
      if (!navigator.onLine) {
        this.updateNetworkStatus('offline', {
          status: 'offline',
          lastChecked: new Date(),
        })
        return this.networkInfo
      }

      // 执行网络连通性测试
      const testResults = await this.performConnectivityTests()

      // 分析测试结果
      const networkInfo = this.analyzeTestResults(testResults)

      // 更新网络状态
      this.updateNetworkStatus(networkInfo.status, networkInfo)

      return this.networkInfo
    } catch (error) {
      console.error('Failed to check network status:', error)

      // 检测失败，根据连续失败次数判断状态
      this.consecutiveFailures++

      let status: NetworkStatus
      if (this.consecutiveFailures >= this.config.unstableThreshold) {
        status = 'offline'
      } else {
        status = 'unstable'
      }

      this.updateNetworkStatus(status, {
        status,
        lastChecked: new Date(),
      })

      return this.networkInfo
    }
  }

  // 测试特定 URL 的连通性
  async testConnectivity(url: string): Promise<{
    success: boolean
    latency?: number
    error?: string
  }> {
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutDuration
      )

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache',
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 获取网络连接类型
  async getConnectionType(): Promise<string> {
    try {
      // 尝试使用 Network Information API
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        return connection?.effectiveType || connection?.type || 'unknown'
      }

      // 尝试通过 Tauri 获取网络信息
      const networkType = await invoke<string>('get_network_type').catch(
        () => 'unknown'
      )
      return networkType
    } catch (error) {
      console.warn('Failed to get connection type:', error)
      return 'unknown'
    }
  }

  // 估算网络速度
  async estimateNetworkSpeed(): Promise<number> {
    try {
      // 使用小文件下载测试网络速度
      const testUrl = 'https://httpbin.org/bytes/1024' // 1KB test file
      const startTime = Date.now()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(testUrl, {
        signal: controller.signal,
        cache: 'no-cache',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      await response.blob()
      const duration = Date.now() - startTime

      // 计算速度 (Kbps)
      const speed = (1024 * 8) / (duration / 1000) / 1000 // Mbps

      return Math.round(speed * 100) / 100
    } catch (error) {
      console.warn('Failed to estimate network speed:', error)
      return 0
    }
  }

  // 私有方法：设置浏览器网络监听器
  private setupBrowserNetworkListeners(): void {
    window.addEventListener('online', this.handleBrowserOnline)
    window.addEventListener('offline', this.handleBrowserOffline)
  }

  // 私有方法：设置 Tauri 网络监听器
  private async setupTauriNetworkListeners(): Promise<void> {
    try {
      // 监听网络状态变化事件
      await listen('network-status-changed', event => {
        console.log('Network status changed (Tauri):', event.payload)
        this.handleTauriNetworkChange(event.payload as any)
      })

      // 监听网络连接类型变化
      await listen('network-type-changed', event => {
        console.log('Network type changed (Tauri):', event.payload)
        this.handleTauriNetworkTypeChange(event.payload as any)
      })
    } catch (error) {
      console.warn('Failed to setup Tauri network listeners:', error)
    }
  }

  // 私有方法：处理浏览器在线事件
  private handleBrowserOnline = (): void => {
    console.log('Browser online event')
    this.checkNetworkStatus()
  }

  // 私有方法：处理浏览器离线事件
  private handleBrowserOffline = (): void => {
    console.log('Browser offline event')
    this.updateNetworkStatus('offline', {
      status: 'offline',
      lastChecked: new Date(),
    })
  }

  // 私有方法：处理 Tauri 网络状态变化
  private handleTauriNetworkChange(payload: any): void {
    const status = payload.status as NetworkStatus
    this.updateNetworkStatus(status, {
      status,
      type: payload.type,
      lastChecked: new Date(),
    })
  }

  // 私有方法：处理 Tauri 网络类型变化
  private handleTauriNetworkTypeChange(payload: any): void {
    this.networkInfo = {
      ...this.networkInfo,
      type: payload.type,
      lastChecked: new Date(),
    }

    // 触发状态变化回调
    this.notifyStatusChange()
  }

  // 私有方法：执行连通性测试
  private async performConnectivityTests(): Promise<
    Array<{
      url: string
      success: boolean
      latency?: number
      error?: string
    }>
  > {
    const testPromises = this.config.testUrls.map(async url => {
      const result = await this.testConnectivity(url)
      return {
        url,
        ...result,
      }
    })

    return await Promise.all(testPromises)
  }

  // 私有方法：分析测试结果
  private analyzeTestResults(
    results: Array<{
      url: string
      success: boolean
      latency?: number
      error?: string
    }>
  ): NetworkInfo {
    const successfulTests = results.filter(r => r.success)
    const failedTests = results.filter(r => !r.success)

    // 如果所有测试都失败，认为是离线
    if (successfulTests.length === 0) {
      return {
        status: 'offline',
        lastChecked: new Date(),
      }
    }

    // 计算平均延迟
    const avgLatency =
      successfulTests.reduce((sum, test) => sum + (test.latency || 0), 0) /
      successfulTests.length

    // 判断网络状态
    let status: NetworkStatus
    if (failedTests.length >= this.config.unstableThreshold) {
      status = 'unstable'
    } else if (avgLatency > this.config.slowThreshold) {
      status = 'slow'
    } else {
      status = 'online'
    }

    return {
      status,
      latency: Math.round(avgLatency),
      lastChecked: new Date(),
    }
  }

  // 私有方法：更新网络状态
  private updateNetworkStatus(
    status: NetworkStatus,
    info: Partial<NetworkInfo>
  ): void {
    const previousStatus = this.currentStatus

    this.currentStatus = status
    this.networkInfo = {
      ...this.networkInfo,
      ...info,
      status,
    }

    // 重置连续失败计数
    if (status === 'online') {
      this.consecutiveFailures = 0
    }

    // 如果状态发生变化，通知监听器
    if (previousStatus !== status) {
      console.log(`Network status changed: ${previousStatus} -> ${status}`)
      this.notifyStatusChange()
    }
  }

  // 私有方法：通知状态变化
  private notifyStatusChange(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.currentStatus, this.networkInfo)
      } catch (error) {
        console.error('Error in network status callback:', error)
      }
    })
  }

  // 私有方法：启动定期检测
  private startPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
    }

    this.checkTimer = setInterval(async () => {
      try {
        await this.checkNetworkStatus()
      } catch (error) {
        console.error('Periodic network check failed:', error)
      }
    }, this.config.checkInterval)

    console.log(
      `Periodic network check started with interval: ${this.config.checkInterval}ms`
    )
  }
}

// 导出单例实例
export const networkStatusService = NetworkStatusService.getInstance()
