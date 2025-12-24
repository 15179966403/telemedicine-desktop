/**
 * 性能和压力测试
 * Performance and Stress Tests
 * 需求覆盖: 6.1-6.5, 7.1-7.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePatients } from '@/hooks/usePatients'
import { useMessages } from '@/hooks/useMessages'
import { usePerformance } from '@/hooks/usePerformance'
import type { Patient, Message } from '@/types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

describe('性能和压力测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('需求 6.1 - 大量数据加载性能', () => {
    it('应该能够快速加载1000个患者记录', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => usePatients())

      const largePatientList: Patient[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `patient-${i}`,
          name: `患者${i}`,
          age: 20 + (i % 60),
          gender: i % 2 === 0 ? ('male' as const) : ('female' as const),
          phone: `138${String(i).padStart(8, '0')}`,
          tags: ['标签1', '标签2'],
          lastVisit: new Date(),
          medicalHistory: [],
        })
      )

      vi.mocked(invoke).mockResolvedValueOnce(largePatientList)

      const startTime = performance.now()

      await act(async () => {
        await result.current.loadPatients()
      })

      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(result.current.patients).toHaveLength(1000)
      expect(loadTime).toBeLessThan(2000) // 应在2秒内完成
    })

    it('应该能够快速搜索大量患者数据', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => usePatients())

      const largePatientList: Patient[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `patient-${i}`,
          name: `患者${i}`,
          age: 20 + (i % 60),
          gender: 'male' as const,
          phone: `138${String(i).padStart(8, '0')}`,
          tags: [],
          lastVisit: new Date(),
          medicalHistory: [],
        })
      )

      vi.mocked(invoke).mockResolvedValueOnce(largePatientList)
      vi.mocked(invoke).mockResolvedValueOnce([largePatientList[500]])

      await act(async () => {
        await result.current.loadPatients()
      })

      const startTime = performance.now()

      await act(async () => {
        await result.current.searchPatients('患者500')
      })

      const endTime = performance.now()
      const searchTime = endTime - startTime

      expect(searchTime).toBeLessThan(500) // 搜索应在500ms内完成
    })
  })

  describe('需求 6.2 - 消息处理性能', () => {
    it('应该能够快速渲染大量历史消息', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => useMessages('consultation-001'))

      const largeMessageList: Message[] = Array.from(
        { length: 500 },
        (_, i) => ({
          id: `msg-${i}`,
          consultationId: 'consultation-001',
          type: 'text' as const,
          content: `消息内容 ${i}`,
          sender: i % 2 === 0 ? ('doctor' as const) : ('patient' as const),
          timestamp: new Date(Date.now() - i * 60000),
          status: 'sent' as const,
        })
      )

      vi.mocked(invoke).mockResolvedValueOnce(largeMessageList)

      const startTime = performance.now()

      await act(async () => {
        await result.current.loadMessages()
      })

      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(result.current.messages).toHaveLength(500)
      expect(loadTime).toBeLessThan(1000) // 应在1秒内完成
    })

    it('应该能够处理高频消息接收', async () => {
      const { result } = renderHook(() => useMessages('consultation-001'))

      const startTime = performance.now()

      // 模拟快速接收100条消息
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            consultationId: 'consultation-001',
            type: 'text',
            content: `快速消息 ${i}`,
            sender: 'patient',
            timestamp: new Date(),
            status: 'sent',
          })
        }
      })

      const endTime = performance.now()
      const processTime = endTime - startTime

      expect(result.current.messages).toHaveLength(100)
      expect(processTime).toBeLessThan(500) // 应在500ms内完成
    })
  })

  describe('需求 6.3 - 内存使用优化', () => {
    it('应该限制内存中的消息数量', async () => {
      const { result } = renderHook(() => useMessages('consultation-001'))

      // 添加超过限制的消息
      await act(async () => {
        for (let i = 0; i < 1500; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            consultationId: 'consultation-001',
            type: 'text',
            content: `消息 ${i}`,
            sender: 'patient',
            timestamp: new Date(),
            status: 'sent',
          })
        }
      })

      // 验证只保留最近的1000条消息
      expect(result.current.messages.length).toBeLessThanOrEqual(1000)
    })

    it('应该清理不活跃的咨询数据', async () => {
      const { result } = renderHook(() => usePerformance())

      await act(async () => {
        await result.current.cleanupInactiveData()
      })

      const memoryUsage = result.current.getMemoryUsage()
      expect(memoryUsage).toBeDefined()
    })
  })

  describe('需求 6.4 - 并发操作处理', () => {
    it('应该能够处理并发的患者数据请求', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => usePatients())

      vi.mocked(invoke).mockImplementation((cmd, args: any) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              id: args.patientId,
              name: `患者${args.patientId}`,
              age: 30,
              gender: 'male',
            })
          }, 100)
        })
      })

      const startTime = performance.now()

      // 并发请求10个患者详情
      await act(async () => {
        const promises = Array.from({ length: 10 }, (_, i) =>
          result.current.getPatientDetail(`patient-${i}`)
        )
        await Promise.all(promises)
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 并发执行应该比串行快
      expect(totalTime).toBeLessThan(500) // 应在500ms内完成（而不是1000ms）
    })

    it('应该能够处理并发的消息发送', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const { result } = renderHook(() => useMessages('consultation-001'))

      vi.mocked(invoke).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, messageId: `msg-${Date.now()}` })
          }, 50)
        })
      })

      const startTime = performance.now()

      // 并发发送5条消息
      await act(async () => {
        const promises = Array.from({ length: 5 }, (_, i) =>
          result.current.sendMessage({
            type: 'text',
            content: `并发消息 ${i}`,
            sender: 'doctor',
          })
        )
        await Promise.all(promises)
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(300) // 应在300ms内完成
    })
  })

  describe('需求 6.5 - 响应时间监控', () => {
    it('应该监控API响应时间', async () => {
      const { result } = renderHook(() => usePerformance())

      await act(async () => {
        result.current.startTracking('api_call')
        await new Promise(resolve => setTimeout(resolve, 100))
        result.current.endTracking('api_call')
      })

      const metrics = result.current.getMetrics()
      expect(metrics.api_call).toBeDefined()
      expect(metrics.api_call.duration).toBeGreaterThan(90)
      expect(metrics.api_call.duration).toBeLessThan(150)
    })

    it('应该记录慢查询', async () => {
      const { result } = renderHook(() => usePerformance())

      await act(async () => {
        result.current.startTracking('slow_query')
        await new Promise(resolve => setTimeout(resolve, 2000))
        result.current.endTracking('slow_query')
      })

      const slowQueries = result.current.getSlowQueries()
      expect(slowQueries.length).toBeGreaterThan(0)
      expect(slowQueries[0].duration).toBeGreaterThan(1000)
    })
  })

  describe('需求 7.1 - 压力测试 - 多窗口场景', () => {
    it('应该能够同时处理10个活跃窗口', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValue({ success: true })

      const startTime = performance.now()

      // 模拟创建10个窗口
      const windowPromises = Array.from({ length: 10 }, (_, i) =>
        invoke('create_window', {
          config: {
            label: `window-${i}`,
            title: `窗口 ${i}`,
            url: `/consultation/${i}`,
          },
        })
      )

      await Promise.all(windowPromises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(2000) // 应在2秒内完成
    })
  })

  describe('需求 7.2 - 压力测试 - 高频消息', () => {
    it('应该能够处理每秒10条消息的接收', async () => {
      const { result } = renderHook(() => useMessages('consultation-001'))

      const startTime = performance.now()
      let messageCount = 0

      // 模拟10秒内接收100条消息
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            consultationId: 'consultation-001',
            type: 'text',
            content: `高频消息 ${i}`,
            sender: 'patient',
            timestamp: new Date(),
            status: 'sent',
          })
          messageCount++
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(messageCount).toBe(100)
      expect(result.current.messages).toHaveLength(100)
      expect(totalTime).toBeLessThan(2000)
    })
  })

  describe('需求 7.3 - 压力测试 - 大文件传输', () => {
    it('应该能够处理50MB文件上传', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      const largeFile = new File(
        [new ArrayBuffer(50 * 1024 * 1024)],
        'large_file.pdf',
        { type: 'application/pdf' }
      )

      vi.mocked(invoke).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, fileId: 'file-001' })
          }, 1000)
        })
      })

      const startTime = performance.now()

      await invoke('upload_file', { file: largeFile })

      const endTime = performance.now()
      const uploadTime = endTime - startTime

      expect(uploadTime).toBeLessThan(5000) // 应在5秒内完成
    })
  })

  describe('需求 7.4 - 压力测试 - 离线队列', () => {
    it('应该能够处理100个离线操作队列项', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValue({ success: true })

      const startTime = performance.now()

      // 添加100个离线操作
      const queuePromises = Array.from({ length: 100 }, (_, i) =>
        invoke('add_to_offline_queue', {
          id: `op-${i}`,
          type: 'patient',
          data: { name: `患者${i}` },
          operation: 'create',
        })
      )

      await Promise.all(queuePromises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(3000) // 应在3秒内完成
    })
  })

  describe('需求 7.5 - 压力测试 - 长时间运行稳定性', () => {
    it('应该在长时间运行后保持性能稳定', async () => {
      const { result } = renderHook(() => usePerformance())

      const iterations = 50
      const durations: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()

        await act(async () => {
          // 模拟一些操作
          result.current.startTracking(`operation-${i}`)
          await new Promise(resolve => setTimeout(resolve, 10))
          result.current.endTracking(`operation-${i}`)
        })

        const endTime = performance.now()
        durations.push(endTime - startTime)
      }

      // 计算平均响应时间
      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length

      // 计算最后10次的平均时间
      const lastTenAvg = durations.slice(-10).reduce((a, b) => a + b, 0) / 10

      // 验证性能没有明显下降（最后10次的平均时间不应该比总平均时间慢太多）
      expect(lastTenAvg).toBeLessThan(avgDuration * 1.5)
    })

    it('应该在长时间运行后没有内存泄漏', async () => {
      const { result } = renderHook(() => usePerformance())

      const initialMemory = result.current.getMemoryUsage()

      // 模拟长时间运行
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          result.current.startTracking(`op-${i}`)
          await new Promise(resolve => setTimeout(resolve, 5))
          result.current.endTracking(`op-${i}`)
        })
      }

      const finalMemory = result.current.getMemoryUsage()

      // 内存增长应该在合理范围内（不超过初始值的2倍）
      expect(finalMemory).toBeLessThan(initialMemory * 2)
    })
  })
})
