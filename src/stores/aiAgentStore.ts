// AI Person Agent 状态管理 (aiAgentStore)
import { create } from 'zustand'
import { aiService } from '@/services/ai/aiService'
import { idempotencyService } from '@/services/ai/idempotencyService'
import { toolSandbox } from '@/services/ai/toolSandbox'
import { contextCompressor } from '@/services/ai/contextCompressor'
import { getOpenAIToolsSchema } from '@/services/ai/toolRegistry'
import type {
  Patient,
  AiSession,
  AiMessage,
  PendingToolConfirmation,
  AiToolAuditRecord,
} from '@/types'

interface AIAgentState {
  currentPatient: Patient | null
  currentSession: AiSession | null
  activeMessages: AiMessage[]
  isGenerating: boolean
  activeRequestId: string | null
  streamingContent: string
  streamingReasoning: string
  pendingConfirmations: PendingToolConfirmation[]
  isApiKeyConfigured: boolean
  toolAudits: AiToolAuditRecord[]
  loadingHistory: boolean

  // Actions
  checkApiKeyStatus: () => Promise<boolean>
  setCurrentPatient: (patient: Patient) => Promise<void>
  sendMessage: (prompt: string) => Promise<void>
  abortGeneration: () => Promise<void>
  resolveConfirmation: (confirmationId: string, allowed: boolean) => void
  refreshToolAudits: () => Promise<void>
  clearCurrentSession: () => void
}

export const useAIAgentStore = create<AIAgentState>((set, get) => ({
  currentPatient: null,
  currentSession: null,
  activeMessages: [],
  isGenerating: false,
  activeRequestId: null,
  streamingContent: '',
  streamingReasoning: '',
  pendingConfirmations: [],
  isApiKeyConfigured: false,
  toolAudits: [],
  loadingHistory: false,

    checkApiKeyStatus: async () => {
      const configured = await aiService.getApiKeyStatus()
      set({ isApiKeyConfigured: configured })
      return configured
    },

    clearCurrentSession: () => {
      set({
        activeMessages: [],
        streamingContent: '',
        streamingReasoning: '',
        pendingConfirmations: [],
        toolAudits: [],
      })
    },

    setCurrentPatient: async (patient: Patient) => {
      set({ loadingHistory: true, currentPatient: patient })
      try {
        const session = await aiService.getOrCreateSession(
          patient.id,
          `${patient.name} 的专属健康助理`
        )
        const messages = await aiService.getActiveMessages(session.id)
        const audits = await aiService.getToolAudits(session.id)

        set({
          currentSession: session,
          activeMessages: messages,
          toolAudits: audits,
          loadingHistory: false,
        })
      } catch (err) {
        console.warn('Failed to set current patient for AI session, using fallback:', err)
        const fallbackSession: AiSession = {
          id: `sess_${patient.id}`,
          patient_id: String(patient.id),
          title: `${patient.name} 的专属健康助理`,
          model: 'deepseek-chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        set({
          currentSession: fallbackSession,
          activeMessages: [],
          toolAudits: [],
          loadingHistory: false,
        })
      }
    },

    abortGeneration: async () => {
      const { activeRequestId } = get()
      if (activeRequestId) {
        await aiService.abortStreamChat(activeRequestId)
        set({ isGenerating: false, activeRequestId: null })
      }
    },

    resolveConfirmation: (confirmationId: string, allowed: boolean) => {
      const item = get().pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId
      )
      if (item) {
        item.resolve(allowed)
        set((state) => ({
          pendingConfirmations: state.pendingConfirmations.filter(
            (c) => c.confirmationId !== confirmationId
          ),
        }))
        get().refreshToolAudits()
      }
    },

    refreshToolAudits: async () => {
      const { currentSession } = get()
      if (currentSession) {
        const audits = await aiService.getToolAudits(currentSession.id)
        set({ toolAudits: audits })
      }
    },

    sendMessage: async (prompt: string) => {
      const { currentSession, currentPatient, isGenerating } = get()
      const text = prompt.trim()
      if (!text || isGenerating) return

      // 1. 自动确保 Session 存在，绝不因未初始化而阻断发送
      let session = currentSession
      if (!session) {
        const pId = currentPatient?.id || 'demo_101'
        const pName = currentPatient?.name || '张建国 (示范客户)'
        try {
          session = await aiService.getOrCreateSession(
            pId,
            `${pName} 的专属健康助理`
          )
        } catch {
          session = {
            id: `sess_${pId}_${Date.now()}`,
            patient_id: String(pId),
            title: `${pName} 的专属健康助理`,
            model: 'deepseek-chat',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }
        set({ currentSession: session })
      }

      const userMsgId = `msg_user_${Date.now()}`
      const requestId = `req_${Date.now()}`

      // 2. 核心：乐观更新！用户发送的信息第一毫秒必须显示在聊天窗口
      const userMessage: AiMessage = {
        id: userMsgId,
        session_id: session.id,
        role: 'user',
        content: text,
        is_archived: 0,
        tokens_estimate: contextCompressor.estimateTokens(text),
        created_at: new Date().toISOString(),
      }

      const updatedMessages = [...get().activeMessages, userMessage]
      set({
        activeMessages: updatedMessages,
        isGenerating: true,
        activeRequestId: requestId,
        streamingContent: '',
        streamingReasoning: '',
      })

      // 异步持久化用户消息 (不阻塞界面)
      aiService.saveMessage(userMessage).catch((err) => {
        console.warn('Failed to save user message locally:', err)
      })

      // 3. 幂等性控制 (非阻塞保护)
      let idempotencyKey = ''
      try {
        idempotencyKey = await idempotencyService.generateHash(
          `${session.id}_${text}_${updatedMessages.length}`
        )
        const idempRecord = await idempotencyService.checkOrInit(
          idempotencyKey,
          'chat_stream',
          session.id,
          text
        )

        if (idempRecord.status === 'completed' && idempRecord.result_payload) {
          const cachedMsg: AiMessage = {
            id: `msg_cached_${Date.now()}`,
            session_id: session.id,
            role: 'assistant',
            content: idempRecord.result_payload,
            is_archived: 0,
            tokens_estimate: 0,
            created_at: new Date().toISOString(),
          }
          set((state) => ({
            activeMessages: [...state.activeMessages, cachedMsg],
            isGenerating: false,
            activeRequestId: null,
          }))
          return
        }
      } catch (err) {
        console.warn('Idempotency warning:', err)
      }

      // 4. 检查是否已配置 API Key，若未配置直接在界面给出气泡指引
      const isKeyConfigured = await aiService.getApiKeyStatus()
      if (!isKeyConfigured) {
        const hintMessage: AiMessage = {
          id: `msg_hint_${Date.now()}`,
          session_id: session.id,
          role: 'assistant',
          content:
            '⚠️ 当前尚未检测到有效的 DeepSeek API Key。请点击右上角【设置】按钮输入您的 API Key 并保存，即可畅享原生流式推演与决策分析。',
          is_archived: 0,
          tokens_estimate: 0,
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          activeMessages: [...state.activeMessages, hintMessage],
          isGenerating: false,
          activeRequestId: null,
          streamingContent: '',
          streamingReasoning: '',
        }))
        return
      }

      // 5. 封装单轮流式推演执行器 (Promise-wrapped Stream Runner)
      const runTurn = (
        reqId: string,
        msgs: any[],
        tools?: any[]
      ): Promise<{
        fullContent: string
        fullReasoning: string
        toolCalls: Array<{ id: string; name: string; arguments: string }>
        error?: string
      }> => {
        return new Promise((resolve) => {
          let content = ''
          let reasoning = ''
          const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>()
          let hasResolved = false

          const safeResolve = (data: {
            fullContent: string
            fullReasoning: string
            toolCalls: Array<{ id: string; name: string; arguments: string }>
            error?: string
          }) => {
            if (!hasResolved) {
              hasResolved = true
              resolve(data)
            }
          }

          aiService
            .startStreamChat(
              {
                requestId: reqId,
                sessionId: session.id,
                messages: msgs,
                tools,
                temperature: 0.3,
              },
              (chunk) => {
                if (chunk.error) {
                  safeResolve({
                    fullContent: content,
                    fullReasoning: reasoning,
                    toolCalls: [],
                    error: chunk.error,
                  })
                  return
                }

                if (chunk.delta_content) {
                  content += chunk.delta_content
                  set({ streamingContent: content })
                }
                if (chunk.delta_reasoning) {
                  reasoning += chunk.delta_reasoning
                  set({ streamingReasoning: reasoning })
                }
                if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
                  for (const tc of chunk.tool_calls) {
                    const idx = typeof tc.index === 'number' ? tc.index : 0
                    const existing = toolCallMap.get(idx) || { id: '', name: '', arguments: '' }
                    if (tc.id) existing.id = tc.id
                    if (tc.function?.name) existing.name = tc.function.name
                    if (tc.function?.arguments) existing.arguments += tc.function.arguments
                    toolCallMap.set(idx, existing)
                  }
                }

                if (chunk.done) {
                  const calls = Array.from(toolCallMap.values()).filter((c) => !!c.name)
                  safeResolve({
                    fullContent: content,
                    fullReasoning: reasoning,
                    toolCalls: calls,
                  })
                }
              }
            )
            .catch((err) => {
              safeResolve({
                fullContent: content,
                fullReasoning: reasoning,
                toolCalls: [],
                error: err.message || 'Stream error',
              })
            })
        })
      }

      // 6. 多轮智能体迭代循环 (Multi-turn ReAct / LangChain 循环)
      let currentActiveMessages = updatedMessages
      let turn = 0
      const MAX_TURNS = 3

      try {
        while (turn < MAX_TURNS) {
          if (!get().isGenerating) break

          const modelMessages = contextCompressor.buildModelMessages(
            currentPatient,
            session.rolling_summary,
            currentActiveMessages
          )

          const turnRequestId = `${requestId}_turn${turn}`
          set({
            activeRequestId: turnRequestId,
            streamingContent: '',
            streamingReasoning: '',
          })

          const { fullContent, fullReasoning, toolCalls, error } = await runTurn(
            turnRequestId,
            modelMessages,
            turn < 2 ? getOpenAIToolsSchema() : undefined
          )

          if (error) {
            const errMsg: AiMessage = {
              id: `msg_err_${Date.now()}`,
              session_id: session.id,
              role: 'assistant',
              content: `❌ 请求遇到异常：${error}`,
              is_archived: 0,
              tokens_estimate: 0,
              created_at: new Date().toISOString(),
            }
            currentActiveMessages = [...currentActiveMessages, errMsg]
            set({
              activeMessages: currentActiveMessages,
              isGenerating: false,
              activeRequestId: null,
              streamingContent: '',
              streamingReasoning: '',
            })
            if (idempotencyKey) {
              await idempotencyService.fail(idempotencyKey, error)
            }
            return
          }

          // 如果模型发起了工具调用
          if (toolCalls && toolCalls.length > 0) {
            const formattedCalls = toolCalls.map((c, i) => ({
              id: c.id || `call_${Date.now()}_${i}`,
              type: 'function',
              function: {
                name: c.name,
                arguments: c.arguments || '{}',
              },
            }))

            // 保存 Assistant 的工具调度意图消息
            const assistantMsgWithTool: AiMessage = {
              id: `msg_asst_${Date.now()}`,
              session_id: session.id,
              role: 'assistant',
              content: fullContent || `[调取工具: ${toolCalls.map((c) => c.name).join(', ')}]`,
              reasoning_content: fullReasoning || undefined,
              tool_calls: JSON.stringify(formattedCalls),
              is_archived: 0,
              tokens_estimate: contextCompressor.estimateTokens(fullContent),
              created_at: new Date().toISOString(),
            }
            await aiService.saveMessage(assistantMsgWithTool)
            currentActiveMessages = [...currentActiveMessages, assistantMsgWithTool]
            set({
              activeMessages: currentActiveMessages,
              streamingContent: '',
              streamingReasoning: '',
            })

            // 依次执行每个工具并记录其返回结果
            for (const call of formattedCalls) {
              const toolOutput = await toolSandbox.executeToolCall(
                session.id,
                call.id,
                call.function.name,
                call.function.arguments,
                get().currentPatient
              )

              // 若工具更新了客户标签，同步更新 store 中的客户档案
              if (call.function.name === 'update_patient_tags') {
                try {
                  const parsed = JSON.parse(call.function.arguments || '{}')
                  const newTags = parsed.tags || parsed.tagList
                  const cur = get().currentPatient
                  if (cur && Array.isArray(newTags)) {
                    set({ currentPatient: { ...cur, tags: newTags } })
                  }
                } catch {}
              }

              const toolResultMsg: AiMessage = {
                id: `msg_tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                session_id: session.id,
                role: 'tool',
                content: toolOutput,
                tool_call_id: call.id,
                is_archived: 0,
                tokens_estimate: contextCompressor.estimateTokens(toolOutput),
                created_at: new Date().toISOString(),
              }
              await aiService.saveMessage(toolResultMsg)
              currentActiveMessages = [...currentActiveMessages, toolResultMsg]
            }

            set({ activeMessages: currentActiveMessages })
            get().refreshToolAudits()

            // 进入下一轮 (Turn 2)，让 DeepSeek 解读工具结果并输出专业结论
            turn++
            continue
          }

          // 普通文本回复生成完毕（或工具解读完毕）
          const assistantMessage: AiMessage = {
            id: `msg_asst_${Date.now()}`,
            session_id: session.id,
            role: 'assistant',
            content: fullContent,
            reasoning_content: fullReasoning || undefined,
            is_archived: 0,
            tokens_estimate: contextCompressor.estimateTokens(fullContent),
            created_at: new Date().toISOString(),
          }

          await aiService.saveMessage(assistantMessage).catch(() => {})
          currentActiveMessages = [...currentActiveMessages, assistantMessage]

          if (idempotencyKey) {
            await idempotencyService.complete(idempotencyKey, fullContent)
          }

          set({
            activeMessages: currentActiveMessages,
            isGenerating: false,
            activeRequestId: null,
            streamingContent: '',
            streamingReasoning: '',
          })

          // 检查超长会话滚动压缩
          if (contextCompressor.shouldCompress(currentActiveMessages)) {
            contextCompressor.triggerBackgroundCompression(
              session.id,
              session.rolling_summary,
              currentActiveMessages
            )
          }

          // 本轮结束
          break
        }
      } catch (err: any) {
        console.error('Failed in stream generation:', err)
        if (idempotencyKey) {
          await idempotencyService.fail(
            idempotencyKey,
            err.message || 'Stream error'
          )
        }
        const failMessage: AiMessage = {
          id: `msg_err_${Date.now()}`,
          session_id: session.id,
          role: 'assistant',
          content: `⚠️ 生成遇到问题：${err.message || '网络连接超时'}。请检查系统设置中的 API Key 或 Base URL 是否正常。`,
          is_archived: 0,
          tokens_estimate: 0,
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          activeMessages: [...state.activeMessages, failMessage],
          isGenerating: false,
          activeRequestId: null,
          streamingContent: '',
          streamingReasoning: '',
        }))
      }
    },
}))

// 注册沙箱确认处理器 (在 store 实例创建完成后绑定，消除与 Service 层的循环依赖)
toolSandbox.setConfirmationHandler((conf) => {
  return new Promise<boolean>((resolve) => {
    useAIAgentStore.setState((state) => ({
      pendingConfirmations: [
        ...state.pendingConfirmations,
        {
          ...conf,
          resolve: (allowed: boolean) => {
            conf.resolve(allowed)
            resolve(allowed)
          },
        },
      ],
    }))
  })
})
