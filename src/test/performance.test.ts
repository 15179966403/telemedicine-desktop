import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MemoryMonitor,
  CacheManager,
  PerformanceMonitor,
  debounce,
  throttle,
} from '@/utils/performance'

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor

  beforeEach(() => {
    monitor = MemoryMonitor.getInstance()
  })

  afterEach(() => {
    monitor.stopMonitoring()
  })

  it('should be a singleton', () => {
    const monitor2 = MemoryMonitor.getInstance()
    expect(monitor).toBe(monitor2)
  })

  it('should start and stop monitoring', () => {
    monitor.startMonitoring(1000)
    expect(() => monitor.stopMonitoring()).not.toThrow()
  })

  it('should add and remove listeners', () => {
    const listener = vi.fn()
    monitor.addListener(listener)
    monitor.removeListener(listener)
    expect(() => monitor.removeListener(listener)).not.toThrow()
  })

  it('should get current memory usage if available', () => {
    const usage = monitor.getCurrentUsage()
    // Memory API may not be available in test environment
    if (usage) {
      expect(usage).toHaveProperty('usedJSHeapSize')
      expect(usage).toHaveProperty('totalJSHeapSize')
      expect(usage).toHaveProperty('jsHeapSizeLimit')
      expect(usage).toHaveProperty('percentage')
    }
  })
})

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = CacheManager.getInstance()
    cache.clear()
  })

  it('should be a singleton', () => {
    const cache2 = CacheManager.getInstance()
    expect(cache).toBe(cache2)
  })

  it('should set and get cache values', () => {
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
  })

  it('should return null for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeNull()
  })

  it('should delete cache entries', () => {
    cache.set('key1', 'value1')
    cache.delete('key1')
    expect(cache.get('key1')).toBeNull()
  })

  it('should clear all cache', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    cache.clear()
    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBeNull()
  })

  it('should respect TTL', async () => {
    cache.set('key1', 'value1', 100) // 100ms TTL
    expect(cache.get('key1')).toBe('value1')

    await new Promise(resolve => setTimeout(resolve, 150))
    expect(cache.get('key1')).toBeNull()
  })

  it('should clear expired entries', async () => {
    cache.set('key1', 'value1', 100)
    cache.set('key2', 'value2', 1000)

    await new Promise(resolve => setTimeout(resolve, 150))
    cache.clearExpired()

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBe('value2')
  })

  it('should provide cache statistics', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    const stats = cache.getStats()
    expect(stats.count).toBe(2)
    expect(stats.size).toBeGreaterThan(0)
    expect(stats.maxSize).toBeGreaterThan(0)
    expect(stats.percentage).toBeGreaterThanOrEqual(0)
  })

  it('should evict oldest entries when cache is full', () => {
    // Create a small cache for testing
    const smallCache = new (CacheManager as any)()
    smallCache.maxCacheSize = 100 // Very small size

    // Fill cache
    for (let i = 0; i < 10; i++) {
      smallCache.set(`key${i}`, `value${i}`)
    }

    // First entries should be evicted
    expect(smallCache.get('key0')).toBeNull()
  })
})

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance()
    monitor.clear()
  })

  it('should be a singleton', () => {
    const monitor2 = PerformanceMonitor.getInstance()
    expect(monitor).toBe(monitor2)
  })

  it('should record metrics', () => {
    monitor.recordMetric('test_operation', 100)
    const stats = monitor.getStats('test_operation')

    expect(stats).not.toBeNull()
    expect(stats?.count).toBe(1)
    expect(stats?.average).toBe(100)
  })

  it('should calculate statistics correctly', () => {
    monitor.recordMetric('test_operation', 100)
    monitor.recordMetric('test_operation', 200)
    monitor.recordMetric('test_operation', 300)

    const stats = monitor.getStats('test_operation')

    expect(stats?.count).toBe(3)
    expect(stats?.average).toBe(200)
    expect(stats?.min).toBe(100)
    expect(stats?.max).toBe(300)
    expect(stats?.total).toBe(600)
  })

  it('should clear specific metric', () => {
    monitor.recordMetric('test1', 100)
    monitor.recordMetric('test2', 200)

    monitor.clear('test1')

    expect(monitor.getStats('test1')).toBeNull()
    expect(monitor.getStats('test2')).not.toBeNull()
  })

  it('should clear all metrics', () => {
    monitor.recordMetric('test1', 100)
    monitor.recordMetric('test2', 200)

    monitor.clear()

    expect(monitor.getStats('test1')).toBeNull()
    expect(monitor.getStats('test2')).toBeNull()
  })

  it('should get all metric keys', () => {
    monitor.recordMetric('test1', 100)
    monitor.recordMetric('test2', 200)

    const keys = monitor.getKeys()
    expect(keys).toContain('test1')
    expect(keys).toContain('test2')
  })

  it('should limit metrics per key', () => {
    // Record more than maxMetricsPerKey (100)
    for (let i = 0; i < 150; i++) {
      monitor.recordMetric('test_operation', i)
    }

    const stats = monitor.getStats('test_operation')
    expect(stats?.count).toBeLessThanOrEqual(100)
  })
})

describe('debounce', () => {
  it('should debounce function calls', async () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    await new Promise(resolve => setTimeout(resolve, 150))

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should pass arguments correctly', async () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn('arg1', 'arg2')

    await new Promise(resolve => setTimeout(resolve, 150))

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should reset timer on subsequent calls', async () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    await new Promise(resolve => setTimeout(resolve, 50))
    debouncedFn()
    await new Promise(resolve => setTimeout(resolve, 50))
    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    await new Promise(resolve => setTimeout(resolve, 150))

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle', () => {
  it('should throttle function calls', async () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn()
    throttledFn()
    throttledFn()

    expect(fn).toHaveBeenCalledTimes(1)

    await new Promise(resolve => setTimeout(resolve, 150))

    throttledFn()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments correctly', () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn('arg1', 'arg2')

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should allow calls after limit period', async () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn()
    expect(fn).toHaveBeenCalledTimes(1)

    await new Promise(resolve => setTimeout(resolve, 150))

    throttledFn()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('Performance Integration', () => {
  it('should work together for memory and cache management', () => {
    const memoryMonitor = MemoryMonitor.getInstance()
    const cacheManager = CacheManager.getInstance()

    // Set up memory warning handler
    const warningHandler = vi.fn()
    memoryMonitor.addListener(warningHandler)

    // Fill cache
    for (let i = 0; i < 10; i++) {
      cacheManager.set(`key${i}`, `value${i}`)
    }

    const stats = cacheManager.getStats()
    expect(stats.count).toBe(10)

    // Clean up
    memoryMonitor.removeListener(warningHandler)
    cacheManager.clear()
  })

  it('should measure operation performance', async () => {
    const perfMonitor = PerformanceMonitor.getInstance()

    const operation = async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'result'
    }

    const start = performance.now()
    const result = await operation()
    const duration = performance.now() - start

    perfMonitor.recordMetric('test_async_operation', duration)

    expect(result).toBe('result')

    const stats = perfMonitor.getStats('test_async_operation')
    expect(stats?.average).toBeGreaterThan(40)
  })
})
