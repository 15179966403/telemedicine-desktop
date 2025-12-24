// 应用启动优化工具
import { invoke } from '@tauri-apps/api/core'

export interface StartupMetrics {
  startTime: number
  databaseInitTime?: number
  authCheckTime?: number
  uiRenderTime?: number
  totalTime?: number
}

export class StartupOptimizer {
  private static metrics: StartupMetrics = {
    startTime: Date.now(),
  }

  /**
   * 记录启动指标
   */
  static recordMetric(key: keyof StartupMetrics, value: number): void {
    this.metrics[key] = value
  }

  /**
   * 获取启动指标
   */
  static getMetrics(): StartupMetrics {
    return { ...this.metrics }
  }

  /**
   * 预加载关键资源
   */
  static async preloadCriticalResources(): Promise<void> {
    const tasks = [
      // 初始化数据库
      this.initDatabase(),
      // 预热缓存
      this.warmupCache(),
      // 检查会话
      this.checkSession(),
    ]

    await Promise.allSettled(tasks)
  }

  /**
   * 初始化数据库
   */
  private static async initDatabase(): Promise<void> {
    const start = Date.now()
    try {
      await invoke('init_database')
      this.recordMetric('databaseInitTime', Date.now() - start)
    } catch (error) {
      console.error('数据库初始化失败:', error)
    }
  }

  /**
   * 预热缓存
   */
  private static async warmupCache(): Promise<void> {
    try {
      await invoke('warmup_file_cache')
    } catch (error) {
      console.error('缓存预热失败:', error)
    }
  }

  /**
   * 检查会话
   */
  private static async checkSession(): Promise<void> {
    const start = Date.now()
    try {
      await invoke('auth_validate_session')
      this.recordMetric('authCheckTime', Date.now() - start)
    } catch (error) {
      console.error('会话检查失败:', error)
    }
  }

  /**
   * 延迟加载非关键资源
   */
  static deferNonCriticalResources(): void {
    // 使用 requestIdleCallback 延迟加载
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.loadNonCriticalResources()
      })
    } else {
      setTimeout(() => {
        this.loadNonCriticalResources()
      }, 1000)
    }
  }

  /**
   * 加载非关键资源
   */
  private static loadNonCriticalResources(): void {
    // 预加载常用图片
    this.preloadImages()
    // 清理过期缓存
    this.cleanupExpiredCache()
  }

  /**
   * 预加载图片
   */
  private static preloadImages(): void {
    const images = [
      '/tauri.svg',
      '/vite.svg',
      // 添加其他需要预加载的图片
    ]

    images.forEach(src => {
      const img = new Image()
      img.src = src
    })
  }

  /**
   * 清理过期缓存
   */
  private static async cleanupExpiredCache(): Promise<void> {
    try {
      await invoke('cleanup_expired_cache_files')
    } catch (error) {
      console.error('清理缓存失败:', error)
    }
  }

  /**
   * 完成启动并记录总时间
   */
  static finishStartup(): void {
    const totalTime = Date.now() - this.metrics.startTime
    this.recordMetric('totalTime', totalTime)
    console.log('应用启动完成，耗时:', totalTime, 'ms')
    console.log('启动指标:', this.getMetrics())
  }
}
