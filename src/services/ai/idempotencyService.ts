// 本地幂等服务 (基于 Tauri 本地 SQLite 原子状态机 + 内存降级双保险)
import { invoke } from '@tauri-apps/api/core'
import type { AiIdempotencyRecord } from '@/types'

const memoryIdempotencyMap = new Map<string, AiIdempotencyRecord>()

function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

export class IdempotencyService {
  private static instance: IdempotencyService

  static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService()
    }
    return IdempotencyService.instance
  }

  /**
   * 基于输入字符串生成 SHA-256 哈希
   */
  async generateHash(raw: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(raw)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // 简易哈希 fallback
      let hash = 0
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i)
        hash |= 0
      }
      return `hash_${Math.abs(hash)}`
    }
  }

  /**
   * 检查并初始化幂等记录 (绝不阻塞中断发送流程)
   */
  async checkOrInit(
    key: string,
    actionType: string,
    sessionId: string | null,
    requestHash: string
  ): Promise<AiIdempotencyRecord> {
    if (isTauriEnvironment()) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Idempotency IPC timeout')), 2500)
        )
        const invokePromise = invoke<AiIdempotencyRecord>('ai_check_or_init_idempotency', {
          key,
          actionType,
          action_type: actionType,
          sessionId,
          session_id: sessionId,
          requestHash,
          request_hash: requestHash,
        })
        return await Promise.race([invokePromise, timeoutPromise])
      } catch (error) {
        console.warn('Idempotency IPC warning (falling back to memory):', error)
      }
    }

    // 内存降级保障
    const existing = memoryIdempotencyMap.get(key)
    if (existing) {
      return existing
    }

    const newRecord: AiIdempotencyRecord = {
      idempotency_key: key,
      action_type: actionType,
      session_id: sessionId,
      request_hash: requestHash,
      status: 'processing',
      result_payload: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    memoryIdempotencyMap.set(key, newRecord)
    return newRecord
  }

  /**
   * 标记幂等成功并缓存 Payload
   */
  async complete(key: string, resultPayload: string): Promise<void> {
    const mem = memoryIdempotencyMap.get(key)
    if (mem) {
      mem.status = 'completed'
      mem.result_payload = resultPayload
      mem.updated_at = new Date().toISOString()
    }

    if (isTauriEnvironment()) {
      try {
        await invoke('ai_complete_idempotency', {
          key,
          resultPayload,
          result_payload: resultPayload,
        })
      } catch (error) {
        console.warn('Failed to complete idempotency via IPC:', error)
      }
    }
  }

  /**
   * 标记幂等失败
   */
  async fail(key: string, errorMessage: string): Promise<void> {
    const mem = memoryIdempotencyMap.get(key)
    if (mem) {
      mem.status = 'failed'
      mem.error_message = errorMessage
      mem.updated_at = new Date().toISOString()
    }

    if (isTauriEnvironment()) {
      try {
        await invoke('ai_fail_idempotency', {
          key,
          errorMessage,
          error_message: errorMessage,
        })
      } catch (error) {
        console.warn('Failed to mark idempotency failure via IPC:', error)
      }
    }
  }
}

export const idempotencyService = IdempotencyService.getInstance()
