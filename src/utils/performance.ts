/**
 * 性能优化工具集
 * Performance optimization utilities
 */

/**
 * 内存监控器
 * Memory monitor for tracking and managing memory usage
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor
  private memoryThreshold = 100 * 1024 * 1024 // 100MB
  private checkInterval: number | null = null
  private listeners: Array<(usage: MemoryInfo) => void> = []

  private constructor() {}

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor()
    }
    return MemoryMonitor.instance
  }

  /**
   * 开始监控内存使用
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.checkInterval) return

    this.checkInterval = window.setInterval(() => {
      this.checkMemoryUsage()
    }, intervalMs)
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usage: MemoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      }

      this.notifyListeners(usage)

      // 如果内存使用超过阈值，触发清理
      if (usage.usedJSHeapSize > this.memoryThreshold) {
        this.triggerCleanup()
      }
    }
  }

  /**
   * 添加监听器
   */
  addListener(callback: (usage: MemoryInfo) => void): void {
    this.listeners.push(callback)
  }

  /**
   * 移除监听器
   */
  removeListener(callback: (usage: MemoryInfo) => void): void {
    this.listeners = this.listeners.filter(cb => cb !== callback)
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(usage: MemoryInfo): void {
    this.listeners.forEach(callback => callback(usage))
  }

  /**
   * 触发内存清理
   */
  private triggerCleanup(): void {
    console.warn('内存使用过高，触发清理机制')
    // 触发自定义事件，让应用层处理清理逻辑
    window.dispatchEvent(new CustomEvent('memory-cleanup-needed'))
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentUsage(): MemoryInfo | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      }
    }
    return null
  }
}

export interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  percentage: number
}

/**
 * 缓存管理器
 * Cache manager for managing application cache
 */
export class CacheManager {
  private static instance: CacheManager
  private caches: Map<string, CacheEntry> = new Map()
  private maxCacheSize = 50 * 1024 * 1024 // 50MB
  private currentSize = 0

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * 设置缓存
   */
  set(key: string, value: any, ttl?: number): void {
    const size = this.estimateSize(value)
    const entry: CacheEntry = {
      value,
      size,
      timestamp: Date.now(),
      ttl,
    }

    // 如果缓存已存在，先减去旧的大小
    if (this.caches.has(key)) {
      const oldEntry = this.caches.get(key)!
      this.currentSize -= oldEntry.size
    }

    // 检查是否需要清理空间
    while (
      this.currentSize + size > this.maxCacheSize &&
      this.caches.size > 0
    ) {
      this.evictOldest()
    }

    this.caches.set(key, entry)
    this.currentSize += size
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.caches.get(key)
    if (!entry) return null

    // 检查是否过期
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key)
      return null
    }

    return entry.value as T
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    const entry = this.caches.get(key)
    if (entry) {
      this.currentSize -= entry.size
      this.caches.delete(key)
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.caches.clear()
    this.currentSize = 0
  }

  /**
   * 清理过期缓存
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.caches.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.delete(key)
      }
    }
  }

  /**
   * 驱逐最旧的缓存项
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.caches.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  /**
   * 估算对象大小（粗略估算）
   */
  private estimateSize(obj: any): number {
    const str = JSON.stringify(obj)
    return str.length * 2 // 每个字符约2字节
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return {
      size: this.currentSize,
      maxSize: this.maxCacheSize,
      count: this.caches.size,
      percentage: (this.currentSize / this.maxCacheSize) * 100,
    }
  }
}

interface CacheEntry {
  value: any
  size: number
  timestamp: number
  ttl?: number
}

interface CacheStats {
  size: number
  maxSize: number
  count: number
  percentage: number
}

/**
 * 性能监控器
 * Performance monitor for tracking render performance
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private maxMetricsPerKey = 100

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * 记录性能指标
   */
  recordMetric(key: string, duration: number, metadata?: any): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const metrics = this.metrics.get(key)!
    metrics.push({
      duration,
      timestamp: Date.now(),
      metadata,
    })

    // 限制存储的指标数量
    if (metrics.length > this.maxMetricsPerKey) {
      metrics.shift()
    }
  }

  /**
   * 获取性能统计
   */
  getStats(key: string): PerformanceStats | null {
    const metrics = this.metrics.get(key)
    if (!metrics || metrics.length === 0) return null

    const durations = metrics.map(m => m.duration)
    const sum = durations.reduce((a, b) => a + b, 0)
    const avg = sum / durations.length
    const min = Math.min(...durations)
    const max = Math.max(...durations)

    return {
      count: metrics.length,
      average: avg,
      min,
      max,
      total: sum,
    }
  }

  /**
   * 清除指标
   */
  clear(key?: string): void {
    if (key) {
      this.metrics.delete(key)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * 获取所有指标键
   */
  getKeys(): string[] {
    return Array.from(this.metrics.keys())
  }
}

interface PerformanceMetric {
  duration: number
  timestamp: number
  metadata?: any
}

interface PerformanceStats {
  count: number
  average: number
  min: number
  max: number
  total: number
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
