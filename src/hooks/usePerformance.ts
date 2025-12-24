import { useEffect, useRef, useCallback } from 'react'
import { PerformanceMonitor } from '@/utils/performance'

/**
 * 性能监控 Hook
 * Hook for monitoring component render performance
 */
export function usePerformance(componentName: string) {
  const renderCount = useRef(0)
  const startTime = useRef<number>(0)
  const monitor = PerformanceMonitor.getInstance()

  useEffect(() => {
    renderCount.current += 1
  })

  useEffect(() => {
    startTime.current = performance.now()

    return () => {
      const duration = performance.now() - startTime.current
      monitor.recordMetric(componentName, duration, {
        renderCount: renderCount.current,
      })
    }
  })

  const measureOperation = useCallback(
    async <T>(
      operationName: string,
      operation: () => Promise<T>
    ): Promise<T> => {
      const start = performance.now()
      try {
        const result = await operation()
        const duration = performance.now() - start
        monitor.recordMetric(`${componentName}.${operationName}`, duration)
        return result
      } catch (error) {
        const duration = performance.now() - start
        monitor.recordMetric(
          `${componentName}.${operationName}.error`,
          duration
        )
        throw error
      }
    },
    [componentName, monitor]
  )

  return {
    renderCount: renderCount.current,
    measureOperation,
  }
}

/**
 * 内存监控 Hook
 * Hook for monitoring memory usage
 */
export function useMemoryMonitor(
  onMemoryWarning?: (usage: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    percentage: number
  }) => void
) {
  useEffect(() => {
    const handleMemoryCleanup = () => {
      if (onMemoryWarning) {
        const usage = {
          usedJSHeapSize: 0,
          totalJSHeapSize: 0,
          jsHeapSizeLimit: 0,
          percentage: 0,
        }
        if ('memory' in performance) {
          const memory = (performance as any).memory
          usage.usedJSHeapSize = memory.usedJSHeapSize
          usage.totalJSHeapSize = memory.totalJSHeapSize
          usage.jsHeapSizeLimit = memory.jsHeapSizeLimit
          usage.percentage =
            (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        }
        onMemoryWarning(usage)
      }
    }

    window.addEventListener('memory-cleanup-needed', handleMemoryCleanup)

    return () => {
      window.removeEventListener('memory-cleanup-needed', handleMemoryCleanup)
    }
  }, [onMemoryWarning])
}
