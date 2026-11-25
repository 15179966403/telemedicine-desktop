// AI 智能体前端服务层
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  AiSession,
  AiMessage,
  StreamChunkPayload,
  AiToolAuditRecord,
  AIConfigDto,
  AIConfigStatusDto,
} from '@/types'

const STORAGE_KEYS = {
  API_KEY: 'deepseek_api_key',
  BASE_URL: 'deepseek_base_url',
  MODEL: 'deepseek_model',
  SESSIONS: 'ai_sessions_cache',
  MESSAGES: 'ai_messages_cache',
  AUDITS: 'ai_audits_cache',
}

export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
export const DEFAULT_MODEL = 'deepseek-chat'

function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

async function safeInvoke<T>(
  cmd: string,
  args: Record<string, any> = {},
  timeoutMs: number = 3500
): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(`Non-tauri environment: cannot invoke ${cmd}`)
  }

  const invokePromise = invoke<T>(cmd, args)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`本地指令响应超时 (${cmd})，已自动保护并降级`)),
      timeoutMs
    )
  })

  return Promise.race([invokePromise, timeoutPromise])
}

export class AIService {
  private static instance: AIService
  private activeAbortControllers: Map<string, AbortController> = new Map()

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  /**
   * 保存 DeepSeek API Key (双轨持久化：localStorage + Tauri 原生 SQLite)
   */
  async saveApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim()
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.API_KEY, trimmed)
    }

    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_save_api_key', { apiKey: trimmed, api_key: trimmed })
      } catch (err) {
        console.warn('Tauri ai_save_api_key warning (saved to localStorage):', err)
      }
    }
  }

  /**
   * 保存 AI 配置 (API Key, Base URL, Model)
   */
  async saveAIConfig(config: AIConfigDto): Promise<void> {
    if (typeof window !== 'undefined') {
      if (config.apiKey) localStorage.setItem(STORAGE_KEYS.API_KEY, config.apiKey.trim())
      if (config.baseUrl)
        localStorage.setItem(
          STORAGE_KEYS.BASE_URL,
          config.baseUrl.trim().replace(/\/+$/, '')
        )
      if (config.model) localStorage.setItem(STORAGE_KEYS.MODEL, config.model.trim())
    }

    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_save_config', {
          config: {
            api_key: config.apiKey?.trim(),
            base_url: config.baseUrl?.trim().replace(/\/+$/, ''),
            model: config.model?.trim(),
          },
        })
      } catch (err) {
        console.warn('Tauri ai_save_config warning (saved to localStorage):', err)
      }
    }
  }

  /**
   * 获取当前 AI 配置状态
   */
  async getAIConfig(): Promise<AIConfigStatusDto> {
    const localKey =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.API_KEY)
        : null
    const localBaseUrl =
      (typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.BASE_URL)
        : null) || DEFAULT_BASE_URL
    const localModel =
      (typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.MODEL)
        : null) || DEFAULT_MODEL

    if (isTauriEnvironment()) {
      try {
        const remote = await safeInvoke<AIConfigStatusDto>('ai_get_config', {}, 2000)
        return {
          has_configured:
            remote.has_configured || Boolean(localKey && localKey.trim()),
          base_url: remote.base_url || localBaseUrl,
          model: remote.model || localModel,
        }
      } catch {
        // Fallback to local
      }
    }

    return {
      has_configured: Boolean(localKey && localKey.trim()),
      base_url: localBaseUrl,
      model: localModel,
    }
  }

  /**
   * 检查本地是否已配置 API Key
   */
  async getApiKeyStatus(): Promise<boolean> {
    const localKey =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.API_KEY)
        : null
    if (localKey && localKey.trim().length > 0) {
      return true
    }

    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<boolean>('ai_get_api_key_status', {}, 2000)
      } catch {
        return false
      }
    }

    return false
  }

  /**
   * 测试 DeepSeek 接口连通性
   */
  async testConnection(config: AIConfigDto): Promise<string> {
    const effectiveKey =
      config.apiKey?.trim() ||
      (typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
        : '')
    const effectiveBaseUrl = (
      config.baseUrl?.trim() ||
      (typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.BASE_URL)
        : '') ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, '')
    const effectiveModel =
      config.model?.trim() ||
      (typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.MODEL)
        : '') ||
      DEFAULT_MODEL

    if (!effectiveKey) {
      throw new Error('请先输入有效的 DeepSeek API Key 再进行测试')
    }

    // 若在原生 Tauri 环境，优先通过 Rust Native 端测试
    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<string>(
          'ai_test_connection',
          {
            config: {
              api_key: effectiveKey,
              base_url: effectiveBaseUrl,
              model: effectiveModel,
            },
          },
          12000
        )
      } catch (err: any) {
        console.warn('Native test connection failed, falling back to direct fetch:', err)
      }
    }

    // 浏览器 / Web 降级测试通道
    const endpoint = `${effectiveBaseUrl}/chat/completions`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: false,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(
          `DeepSeek 接口验证失败 (HTTP ${response.status}): ${errorText || response.statusText}`
        )
      }

      return `连接成功！DeepSeek 接口响应正常 (HTTP 200)，模型 [${effectiveModel}] 验证通过。`
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error('连接请求超时 (超过 10 秒)，请检查网络连接或 Base URL 是否可达')
      }
      throw err
    }
  }

  /**
   * 获取或初始化客户的唯一持久 Session (1:1 绑定)
   */
  async getOrCreateSession(
    patientId: string | number,
    defaultTitle: string
  ): Promise<AiSession> {
    const pIdStr = String(patientId)

    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<AiSession>('ai_get_or_create_session', {
          patientId: pIdStr,
          patient_id: pIdStr,
          defaultTitle,
          default_title: defaultTitle,
        })
      } catch (err) {
        console.warn('Failed to invoke ai_get_or_create_session, using local cache:', err)
      }
    }

    // Web 缓存降级模式
    const cacheKey = `${STORAGE_KEYS.SESSIONS}_${pIdStr}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {}
    }

    const newSession: AiSession = {
      id: `sess_${pIdStr}_${Date.now()}`,
      patient_id: pIdStr,
      title: defaultTitle,
      model: DEFAULT_MODEL,
      rolling_summary: null,
      system_prompt: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    localStorage.setItem(cacheKey, JSON.stringify(newSession))
    return newSession
  }

  /**
   * 获取活跃未归档的消息
   */
  async getActiveMessages(sessionId: string): Promise<AiMessage[]> {
    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<AiMessage[]>('ai_get_active_messages', {
          sessionId,
          session_id: sessionId,
          limit: 60,
        })
      } catch (err) {
        console.warn('Failed to get active messages via IPC:', err)
      }
    }

    const key = `${STORAGE_KEYS.MESSAGES}_${sessionId}`
    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        const all: AiMessage[] = JSON.parse(cached)
        return all.filter((m) => !m.is_archived)
      } catch {}
    }
    return []
  }

  /**
   * 分页获取完整历史（含归档）
   */
  async getAllMessages(
    sessionId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<AiMessage[]> {
    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<AiMessage[]>('ai_get_all_messages', {
          sessionId,
          session_id: sessionId,
          page,
          pageSize,
          page_size: pageSize,
        })
      } catch (err) {
        console.warn('Failed to get all messages via IPC:', err)
      }
    }

    const key = `${STORAGE_KEYS.MESSAGES}_${sessionId}`
    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        const all: AiMessage[] = JSON.parse(cached)
        const start = (page - 1) * pageSize
        return all.slice(start, start + pageSize)
      } catch {}
    }
    return []
  }

  /**
   * 保存单条消息到 SQLite / 缓存
   */
  async saveMessage(message: AiMessage): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_save_message', { message })
      } catch (err) {
        console.warn('Failed to save message via IPC:', err)
      }
    }

    // 同步更新本地缓存
    const key = `${STORAGE_KEYS.MESSAGES}_${message.session_id}`
    const cached = localStorage.getItem(key)
    let list: AiMessage[] = []
    if (cached) {
      try {
        list = JSON.parse(cached)
      } catch {}
    }
    const idx = list.findIndex((m) => m.id === message.id)
    if (idx >= 0) {
      list[idx] = message
    } else {
      list.push(message)
    }
    localStorage.setItem(key, JSON.stringify(list))
  }

  /**
   * 更新客户会话的滚动摘要
   */
  async updateRollingSummary(
    sessionId: string,
    summary: string,
    archiveBefore?: string
  ): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_update_rolling_summary', {
          sessionId,
          session_id: sessionId,
          summary,
          archiveBefore,
          archive_before: archiveBefore,
        })
      } catch (err) {
        console.warn('Failed to update rolling summary via IPC:', err)
      }
    }

    const key = `${STORAGE_KEYS.MESSAGES}_${sessionId}`
    const cached = localStorage.getItem(key)
    if (cached && archiveBefore) {
      try {
        const list: AiMessage[] = JSON.parse(cached)
        const updated = list.map((m) =>
          m.created_at < archiveBefore ? { ...m, is_archived: 1 } : m
        )
        localStorage.setItem(key, JSON.stringify(updated))
      } catch {}
    }
  }

  /**
   * 发起原生流式聊天请求 (方式 B，在 Web 模式下自动降级为浏览器 SSE 流)
   */
  async startStreamChat(
    params: {
      requestId: string
      sessionId: string
      messages: Array<{
        role: string
        content: string
        name?: string
        tool_call_id?: string
      }>
      tools?: any[]
      temperature?: number
      maxTokens?: number
    },
    onChunk: (payload: StreamChunkPayload) => void
  ): Promise<() => void> {
    if (isTauriEnvironment()) {
      let unlisten: (() => void) | null = null
      try {
        unlisten = await listen<StreamChunkPayload>('ai:chunk', (event) => {
          if (event.payload.request_id === params.requestId) {
            onChunk(event.payload)
          }
        })

        await safeInvoke('ai_chat_stream', {
          request: {
            request_id: params.requestId,
            session_id: params.sessionId,
            messages: params.messages,
            tools: params.tools,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
          },
        })

        return () => {
          if (unlisten) unlisten()
        }
      } catch (err: any) {
        if (unlisten) unlisten()
        console.warn('Tauri native stream chat failed, switching to web fetch:', err)
      }
    }

    // 浏览器 Web 降级模式 (直连 DeepSeek)
    const config = await this.getAIConfig()
    const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY)
    if (!apiKey) {
      onChunk({
        request_id: params.requestId,
        done: true,
        error: '未配置 DeepSeek API Key，请在设置中配置',
      })
      return () => {}
    }

    const controller = new AbortController()
    this.activeAbortControllers.set(params.requestId, controller)

    const endpoint = `${config.base_url.replace(/\/+$/, '')}/chat/completions`

    const requestBody: any = {
      model: config.model,
      messages: params.messages,
      stream: true,
    }
    if (params.tools && params.tools.length > 0) {
      requestBody.tools = params.tools
    }
    if (params.temperature !== undefined) {
      requestBody.temperature = params.temperature
    }
    if (params.maxTokens !== undefined) {
      requestBody.max_tokens = params.maxTokens
    }

    fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          onChunk({
            request_id: params.requestId,
            done: true,
            error: `API 返回错误 (HTTP ${res.status}): ${errText}`,
          })
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          onChunk({
            request_id: params.requestId,
            done: true,
            error: '无法获取响应流 Reader',
          })
          return
        }

        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            onChunk({
              request_id: params.requestId,
              done: true,
              error: null,
            })
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line.startsWith('data:')) continue
            const jsonStr = line.replace(/^data:\s*/, '').trim()
            if (jsonStr === '[DONE]') {
              onChunk({
                request_id: params.requestId,
                done: true,
                error: null,
              })
              return
            }

            try {
              const parsed = JSON.parse(jsonStr)
              const choice = parsed.choices?.[0]
              if (choice?.delta) {
                onChunk({
                  request_id: params.requestId,
                  delta_content: choice.delta.content || null,
                  delta_reasoning: choice.delta.reasoning_content || null,
                  tool_calls: choice.delta.tool_calls || null,
                  done: false,
                  error: null,
                })
              }
            } catch {}
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          onChunk({
            request_id: params.requestId,
            done: true,
            error: '已中止生成',
          })
        } else {
          onChunk({
            request_id: params.requestId,
            done: true,
            error: `流读取异常: ${err.message}`,
          })
        }
      })
      .finally(() => {
        this.activeAbortControllers.delete(params.requestId)
      })

    return () => {
      controller.abort()
      this.activeAbortControllers.delete(params.requestId)
    }
  }

  /**
   * 中止当前流式生成
   */
  async abortStreamChat(requestId: string): Promise<void> {
    const controller = this.activeAbortControllers.get(requestId)
    if (controller) {
      controller.abort()
      this.activeAbortControllers.delete(requestId)
    }

    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_abort_generation', {
          requestId,
          request_id: requestId,
        })
      } catch (error) {
        console.warn('Failed to abort stream via IPC:', error)
      }
    }
  }

  /**
   * 记录工具审计日志
   */
  async logToolAudit(audit: AiToolAuditRecord): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await safeInvoke('ai_log_tool_audit', { audit })
      } catch (error) {
        console.warn('Failed to log tool audit via IPC:', error)
      }
    }

    const key = `${STORAGE_KEYS.AUDITS}_${audit.session_id}`
    const cached = localStorage.getItem(key)
    let list: AiToolAuditRecord[] = []
    if (cached) {
      try {
        list = JSON.parse(cached)
      } catch {}
    }
    list.unshift(audit)
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
  }

  /**
   * 获取工具审计记录
   */
  async getToolAudits(sessionId: string): Promise<AiToolAuditRecord[]> {
    if (isTauriEnvironment()) {
      try {
        return await safeInvoke<AiToolAuditRecord[]>('ai_get_tool_audits', {
          sessionId,
          session_id: sessionId,
          limit: 20,
        })
      } catch (err) {
        console.warn('Failed to get tool audits via IPC:', err)
      }
    }

    const key = `${STORAGE_KEYS.AUDITS}_${sessionId}`
    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {}
    }
    return []
  }
}

export const aiService = AIService.getInstance()
