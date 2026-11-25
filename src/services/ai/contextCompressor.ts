// 超长上下文管理与滚动压缩引擎 (ContextCompressor)
import { aiService } from './aiService'
import type { AiMessage, Patient } from '@/types'

export class ContextCompressor {
  private static instance: ContextCompressor
  // 触发压缩的 Token 阈值 (约 12000 Tokens)
  private readonly COMPRESSION_TOKEN_THRESHOLD = 12000

  static getInstance(): ContextCompressor {
    if (!ContextCompressor.instance) {
      ContextCompressor.instance = new ContextCompressor()
    }
    return ContextCompressor.instance
  }

  /**
   * 粗略估算 Token 数量 (中文字符约 1.5 token, 英文单词约 1 token)
   */
  estimateTokens(text: string): number {
    if (!text) return 0
    let chineseChars = 0
    let otherChars = 0
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 255) {
        chineseChars++
      } else {
        otherChars++
      }
    }
    return Math.ceil(chineseChars * 1.5 + otherChars * 0.4)
  }

  /**
   * 判断当前活跃对话是否需要压缩
   */
  shouldCompress(activeMessages: AiMessage[]): boolean {
    let totalTokens = 0
    for (const msg of activeMessages) {
      totalTokens += this.estimateTokens(msg.content || '')
      totalTokens += this.estimateTokens(msg.reasoning_content || '')
    }
    return totalTokens > this.COMPRESSION_TOKEN_THRESHOLD && activeMessages.length > 15
  }

  /**
   * 组装发送给 DeepSeek 的完整上下文 (System Prompt + 摘要 + 近期工作窗口)
   */
  buildModelMessages(
    patient: Patient | null,
    rollingSummary: string | null | undefined,
    activeMessages: AiMessage[]
  ): Array<{ role: string; content: string; name?: string; tool_call_id?: string }> {
    const patientProfile = patient
      ? {
          id: patient.id,
          customerId: patient.customerId || null,
          name: patient.name,
          gender: patient.gender === 'male' ? '男' : patient.gender === 'female' ? '女' : '未知',
          age: patient.age,
          phone: patient.phone,
          tags: patient.tags || [],
          vipName: patient.vipName || '',
          companyName: patient.companyName || '',
          ownerPhysicianName: patient.ownerPhysicianName || '',
        }
      : null

    const patientInfo = patientProfile
      ? `【当前服务客户完整档案 (JSON)】:
${JSON.stringify(patientProfile, null, 2)}
`
      : '【当前服务客户档案】: 未选定具体客户\n'

    const summarySection = rollingSummary
      ? `【过往对话累积与医疗摘要】:\n${rollingSummary}\n`
      : ''

    const systemPromptContent = `你是由 DeepSeek-4.1-flash 强力驱动的“医生个人智能助理（Person Agent）”。
你的服务对象是一名执业医生或健康管理师，你正在辅助医生针对具体某一位客户进行全面的健康管理、病情评估、体检报告深度解读与随访方案拟定。

${patientInfo}
${summarySection}
【工作准则与安全规范】:
1. 语言风格严谨、专业、结构清晰，符合临床与健康管理学术规范。
2. 当需要读取客户档案、体检报告列表或服务记录时，主动调用对应工具。调用工具时可直接将上述【当前服务客户完整档案 (JSON)】完整传入入参 patientInfo（或传入 patientId），底层函数会根据具体接口规范自动匹配对应 ID 进行精准检索。
3. 若工具反馈该客户暂无体检报告，请如实告知医生该客户暂未归档报告，切勿凭空编造体检指标。
4. 当需要下载体检报告或修改客户标签时，调用对应工具并等待医生人工核准。
5. 若医生审核拒绝了某项操作，尊重医生的临床决策，并提供替代分析方案。
`

    const result: Array<{ role: string; content: string; name?: string; tool_call_id?: string }> = [
      {
        role: 'system',
        content: systemPromptContent,
      },
    ]

    // 注入最近的未归档活跃消息
    for (const msg of activeMessages) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool') {
        const item: any = {
          role: msg.role,
          content: msg.content || '',
        }
        if (msg.role === 'assistant' && msg.tool_calls) {
          try {
            item.tool_calls = typeof msg.tool_calls === 'string'
              ? JSON.parse(msg.tool_calls)
              : msg.tool_calls
          } catch {}
        }
        if (msg.role === 'tool' && msg.tool_call_id) {
          item.tool_call_id = msg.tool_call_id
        }
        result.push(item)
      }
    }

    return result
  }

  /**
   * 后台异步提炼滚动摘要并归档旧消息
   */
  async triggerBackgroundCompression(
    sessionId: string,
    existingSummary: string | null | undefined,
    messagesToCompress: AiMessage[]
  ): Promise<void> {
    if (messagesToCompress.length < 10) return

    const cutoffMessage = messagesToCompress[messagesToCompress.length - 6] // 保留最后5条，压缩其余
    const archiveBefore = cutoffMessage.created_at

    const dialogText = messagesToCompress
      .slice(0, messagesToCompress.length - 5)
      .map((m) => `${m.role === 'user' ? '医生' : 'AI'}: ${m.content || ''}`)
      .join('\n')

    const summaryPrompt = `请阅读以下医生与 AI 助手的既往多轮问诊与健管沟通历史：
既有摘要背景：${existingSummary || '无'}

待压缩历史对话：
${dialogText}

【任务要求】:
将上述历史对话与既有摘要融合成一份最新的《客户医疗健康演变摘要》，要求控制在 500 字以内，清晰罗列：
1. 主诉与当前核心健康问题；
2. 已查明的异常指标与既往判断；
3. 已达成的健管/用药方案共识；
4. 遗留待观察或待复查项。
直接输出摘要正文，无需多余寒暄。`

    const requestId = `comp_${Date.now()}`
    let newSummary = ''

    try {
      await aiService.startStreamChat(
        {
          requestId,
          sessionId,
          messages: [
            {
              role: 'user',
              content: summaryPrompt,
            },
          ],
          temperature: 0.2,
        },
        (chunk) => {
          if (chunk.delta_content) {
            newSummary += chunk.delta_content
          }
          if (chunk.done && newSummary.trim()) {
            aiService.updateRollingSummary(sessionId, newSummary.trim(), archiveBefore)
          }
        }
      )
    } catch (err) {
      console.warn('Background context compression failed:', err)
    }
  }
}

export const contextCompressor = ContextCompressor.getInstance()
