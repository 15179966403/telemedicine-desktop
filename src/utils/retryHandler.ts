/**
 * 网络请求重试处理器
 * Network request retry handler with exponential backoff
 */

import { NetworkError } from './errorHandler'

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
  retryableErrors: string[]
  onRetry?: (attempt: number, error: Error) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTime: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'fetch',
    'network',
  ],
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(
  error: Error,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // 检查是否是网络错误
  if (error instanceof NetworkError) {
    return true
  }

  // 检查错误消息
  const errorMessage = error.message.toLowerCase()
  return config.retryableErrors.some(retryableError =>
    errorMessage.includes(retryableError.toLowerCase())
  )
}

/**
 * 判断 HTTP 状态码是否可重试
 */
export function isRetryableStatusCode(
  statusCode: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return config.retryableStatusCodes.includes(statusCode)
}

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt)
  return Math.min(delay, config.maxDelay)
}

/**
 * 添加随机抖动以避免惊群效应
 */
export function addJitter(delay: number, jitterFactor: number = 0.1): number {
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1)
  return Math.max(0, delay + jitter)
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的异步函数执行器
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const startTime = Date.now()
  let lastError: Error | undefined
  let attempt = 0

  while (attempt <= finalConfig.maxRetries) {
    try {
      const data = await fn()
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error as Error
      attempt++

      // 如果已达到最大重试次数，抛出错误
      if (attempt > finalConfig.maxRetries) {
        break
      }

      // 检查错误是否可重试
      if (!isRetryableError(lastError, finalConfig)) {
        break
      }

      // 调用重试回调
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt, lastError)
      }

      // 计算延迟时间
      const retryDelay = calculateRetryDelay(attempt - 1, finalConfig)
      const delayWithJitter = addJitter(retryDelay)

      console.log(
        `Retry attempt ${attempt}/${finalConfig.maxRetries} after ${Math.round(delayWithJitter)}ms`
      )

      // 等待后重试
      await delay(delayWithJitter)
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalTime: Date.now() - startTime,
  }
}

/**
 * 带重试的 fetch 请求
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const result = await retryAsync(async () => {
    const response = await fetch(url, options)

    // 检查状态码是否可重试
    if (
      !response.ok &&
      isRetryableStatusCode(response.status, {
        ...DEFAULT_RETRY_CONFIG,
        ...config,
      })
    ) {
      throw new NetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        `HTTP_${response.status}`
      )
    }

    return response
  }, config)

  if (!result.success || !result.data) {
    throw result.error || new Error('Request failed')
  }

  return result.data
}

/**
 * 重试装饰器（用于类方法）
 */
export function Retry(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await retryAsync(
        () => originalMethod.apply(this, args),
        config
      )

      if (!result.success) {
        throw result.error
      }

      return result.data
    }

    return descriptor
  }
}

/**
 * 批量重试处理器
 */
export class BatchRetryHandler<T> {
  private queue: Array<{
    id: string
    fn: () => Promise<T>
    resolve: (value: T) => void
    reject: (error: Error) => void
    attempts: number
  }> = []
  private processing = false
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * 添加任务到队列
   */
  add(id: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        fn,
        resolve,
        reject,
        attempts: 0,
      })

      // 开始处理队列
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const task = this.queue[0]

      try {
        const result = await retryAsync(task.fn, this.config)

        if (result.success && result.data !== undefined) {
          task.resolve(result.data)
          this.queue.shift()
        } else {
          task.reject(result.error || new Error('Task failed'))
          this.queue.shift()
        }
      } catch (error) {
        task.reject(error as Error)
        this.queue.shift()
      }
    }

    this.processing = false
  }

  /**
   * 获取队列大小
   */
  getQueueSize(): number {
    return this.queue.length
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'))
    })
    this.queue = []
  }
}
