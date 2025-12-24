/**
 * 重试处理器测试
 * Retry handler tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  retryAsync,
  fetchWithRetry,
  isRetryableError,
  isRetryableStatusCode,
  calculateRetryDelay,
  addJitter,
  BatchRetryHandler,
} from '@/utils/retryHandler'
import { NetworkError } from '@/utils/errorHandler'

describe('RetryHandler', () => {
  describe('isRetryableError', () => {
    it('should identify NetworkError as retryable', () => {
      const error = new NetworkError('Network failed')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should identify fetch errors as retryable', () => {
      const error = new Error('fetch failed')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should identify network errors as retryable', () => {
      const error = new Error('network timeout')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should not identify generic errors as retryable', () => {
      const error = new Error('generic error')
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('isRetryableStatusCode', () => {
    it('should identify 500 as retryable', () => {
      expect(isRetryableStatusCode(500)).toBe(true)
    })

    it('should identify 502 as retryable', () => {
      expect(isRetryableStatusCode(502)).toBe(true)
    })

    it('should identify 503 as retryable', () => {
      expect(isRetryableStatusCode(503)).toBe(true)
    })

    it('should identify 429 as retryable', () => {
      expect(isRetryableStatusCode(429)).toBe(true)
    })

    it('should not identify 404 as retryable', () => {
      expect(isRetryableStatusCode(404)).toBe(false)
    })

    it('should not identify 401 as retryable', () => {
      expect(isRetryableStatusCode(401)).toBe(false)
    })
  })

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        maxRetries: 3,
        retryableStatusCodes: [],
        retryableErrors: [],
      }

      expect(calculateRetryDelay(0, config)).toBe(1000)
      expect(calculateRetryDelay(1, config)).toBe(2000)
      expect(calculateRetryDelay(2, config)).toBe(4000)
      expect(calculateRetryDelay(3, config)).toBe(8000)
    })

    it('should respect max delay', () => {
      const config = {
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        maxRetries: 10,
        retryableStatusCodes: [],
        retryableErrors: [],
      }

      expect(calculateRetryDelay(10, config)).toBe(5000)
    })
  })

  describe('addJitter', () => {
    it('should add jitter to delay', () => {
      const delay = 1000
      const jitteredDelay = addJitter(delay, 0.1)

      // Jitter should be within ±10% of original delay
      expect(jitteredDelay).toBeGreaterThanOrEqual(900)
      expect(jitteredDelay).toBeLessThanOrEqual(1100)
    })

    it('should not return negative delays', () => {
      const delay = 100
      const jitteredDelay = addJitter(delay, 2) // Large jitter factor

      expect(jitteredDelay).toBeGreaterThanOrEqual(0)
    })
  })

  describe('retryAsync', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retryAsync(fn, { maxRetries: 3 })

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success')

      const result = await retryAsync(fn, {
        maxRetries: 3,
        initialDelay: 10,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'))

      const result = await retryAsync(fn, {
        maxRetries: 3,
        initialDelay: 10,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should respect max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new NetworkError('Failed'))

      const result = await retryAsync(fn, {
        maxRetries: 2,
        initialDelay: 10,
      })

      expect(result.success).toBe(false)
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn()
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success')

      await retryAsync(fn, {
        maxRetries: 3,
        initialDelay: 10,
        onRetry,
      })

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(NetworkError))
    })

    it('should track total time', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success')

      const result = await retryAsync(fn, {
        maxRetries: 3,
        initialDelay: 100,
      })

      expect(result.totalTime).toBeGreaterThanOrEqual(100)
    })
  })

  describe('fetchWithRetry', () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it('should succeed on first attempt', async () => {
      const mockResponse = new Response('success', { status: 200 })
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        {},
        {
          maxRetries: 3,
          initialDelay: 10,
        }
      )

      expect(response.status).toBe(200)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on 500 errors', async () => {
      const mockResponse500 = new Response('error', { status: 500 })
      const mockResponse200 = new Response('success', { status: 200 })
      ;(global.fetch as any)
        .mockResolvedValueOnce(mockResponse500)
        .mockResolvedValueOnce(mockResponse200)

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        {},
        {
          maxRetries: 3,
          initialDelay: 10,
        }
      )

      expect(response.status).toBe(200)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 404 errors', async () => {
      const mockResponse = new Response('not found', { status: 404 })
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        {},
        {
          maxRetries: 3,
          initialDelay: 10,
        }
      )

      expect(response.status).toBe(404)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw on max retries exceeded', async () => {
      const mockResponse = new Response('error', { status: 500 })
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(
        fetchWithRetry(
          'https://api.example.com/data',
          {},
          {
            maxRetries: 2,
            initialDelay: 10,
          }
        )
      ).rejects.toThrow()

      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('BatchRetryHandler', () => {
    it('should process tasks in queue', async () => {
      const handler = new BatchRetryHandler<string>({
        maxRetries: 3,
        initialDelay: 10,
      })

      const task1 = vi.fn().mockResolvedValue('result1')
      const task2 = vi.fn().mockResolvedValue('result2')

      const promise1 = handler.add('task1', task1)
      const promise2 = handler.add('task2', task2)

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe('result1')
      expect(result2).toBe('result2')
      expect(task1).toHaveBeenCalled()
      expect(task2).toHaveBeenCalled()
    })

    it('should retry failed tasks', async () => {
      const handler = new BatchRetryHandler<string>({
        maxRetries: 2,
        initialDelay: 10,
      })

      const task = vi
        .fn()
        .mockRejectedValueOnce(new NetworkError('Failed'))
        .mockResolvedValue('success')

      const result = await handler.add('task1', task)

      expect(result).toBe('success')
      expect(task).toHaveBeenCalledTimes(2)
    })

    it('should track queue size', () => {
      const handler = new BatchRetryHandler<string>()

      const task1 = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
        )
      const task2 = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
        )

      handler.add('task1', task1)
      handler.add('task2', task2)

      expect(handler.getQueueSize()).toBeGreaterThan(0)
    })

    it('should clear queue', async () => {
      const handler = new BatchRetryHandler<string>()

      const task = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise(resolve => setTimeout(() => resolve('result'), 1000))
        )

      const promise = handler.add('task1', task)
      handler.clear()

      await expect(promise).rejects.toThrow('Queue cleared')
    })
  })
})
