// AI 智能体类型定义

export interface AiSession {
  id: string
  patient_id: string
  title: string
  model: string
  rolling_summary?: string | null
  system_prompt?: string | null
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string | null
  reasoning_content?: string | null
  tool_calls?: string | null
  tool_call_id?: string | null
  is_archived: number
  tokens_estimate: number
  created_at: string
}

export interface StreamChunkPayload {
  request_id: string
  delta_content?: string | null
  delta_reasoning?: string | null
  tool_calls?: any | null
  done: boolean
  error?: string | null
}

export type SecurityLevel = 'L1' | 'L2' | 'L3'

export interface ToolDefinition {
  name: string
  description: string
  securityLevel: SecurityLevel
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface ToolCallItem {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface PendingToolConfirmation {
  confirmationId: string
  sessionId: string
  toolCallId: string
  toolName: string
  securityLevel: SecurityLevel
  parameters: Record<string, any>
  title: string
  description: string
  diffPreview?: {
    before?: string
    after?: string
  }
  resolve: (allowed: boolean) => void
}

export interface AiIdempotencyRecord {
  idempotency_key: string
  action_type: string
  session_id?: string | null
  request_hash: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result_payload?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface AiToolAuditRecord {
  id: string
  session_id: string
  tool_name: string
  security_level: SecurityLevel
  parameters?: string | null
  user_action?: 'auto_allowed' | 'confirmed' | 'rejected' | null
  execution_result?: string | null
  created_at: string
}

export interface AIConfigDto {
  apiKey?: string
  baseUrl?: string
  model?: string
}

export interface AIConfigStatusDto {
  has_configured: boolean
  base_url: string
  model: string
}
