// AI 本地工具定义与安全等级注册 (L1 / L2 / L3)
import type { ToolDefinition } from '@/types'

export const AGENT_TOOLS: ToolDefinition[] = [
  // -------------------------------------------------------------
  // Level 1: 安全只读查询 (无需人工确认，沙箱自动放行)
  // -------------------------------------------------------------
  {
    name: 'get_patient_profile',
    description: '获取指定客户的基本健康档案，包括姓名、年龄、性别、电话、过敏史及健康标签等。',
    securityLevel: 'L1',
    parameters: {
      type: 'object',
      properties: {
        patientInfo: {
          type: 'object',
          description: '可选：客户完整档案对象 JSON (直接传入系统提示中的客户档案)',
        },
        patientId: {
          type: 'string',
          description: '可选：客户系统主键 ID',
        },
      },
    },
  },
  {
    name: 'list_patient_reports',
    description: '查询该客户在本地以及云端的所有体检报告列表（包含报告ID、体检机构、时间及本地下载状态）。若该客户在系统中暂未上传报告则返回空列表。',
    securityLevel: 'L1',
    parameters: {
      type: 'object',
      properties: {
        patientInfo: {
          type: 'object',
          description: '可选：客户完整档案对象 JSON (直接传入系统提示中的客户档案，底层将自动按真实主键 ID 检索)',
        },
        patientId: {
          type: 'string',
          description: '可选：客户系统主键 ID',
        },
      },
    },
  },
  {
    name: 'list_service_records',
    description: '查询该客户的历史随访与就诊服务记录摘要。',
    securityLevel: 'L1',
    parameters: {
      type: 'object',
      properties: {
        patientInfo: {
          type: 'object',
          description: '可选：客户完整档案对象 JSON',
        },
        patientId: {
          type: 'string',
          description: '可选：客户系统主键 ID',
        },
      },
    },
  },

  // -------------------------------------------------------------
  // Level 2: 敏感资源操作 (网络 I/O、磁盘读写、消耗带宽，需人工单次确认)
  // -------------------------------------------------------------
  {
    name: 'download_medical_report',
    description: '下载该客户的体检报告 PDF 文件到本地存储空间，用于后续深度医学解读。',
    securityLevel: 'L2',
    parameters: {
      type: 'object',
      properties: {
        patientInfo: {
          type: 'object',
          description: '可选：客户完整档案对象 JSON',
        },
        patientId: {
          type: 'string',
          description: '可选：客户系统主键 ID',
        },
        reportId: {
          type: 'string',
          description: '体检报告 ID',
        },
        reportName: {
          type: 'string',
          description: '报告名称或体检项目，如“2025年度全面深度体检报告”',
        },
      },
      required: ['reportId'],
    },
  },

  // -------------------------------------------------------------
  // Level 3: 破坏性/责任性修改 (修改患者健康标签、录入病历，需人工严格双重确认)
  // -------------------------------------------------------------
  {
    name: 'update_patient_tags',
    description: '为该客户新增或修改健康画像/慢病标签（如高血压、糖尿病、脂肪肝等）。此操作会更新客户档案。',
    securityLevel: 'L3',
    parameters: {
      type: 'object',
      properties: {
        patientInfo: {
          type: 'object',
          description: '可选：客户完整档案对象 JSON',
        },
        patientId: {
          type: 'string',
          description: '可选：客户系统主键 ID',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '完整的标签列表',
        },
        reason: {
          type: 'string',
          description: '修改标签的临床理由或依据',
        },
      },
      required: ['tags'],
    },
  },
]

/**
 * 转换为 OpenAI/DeepSeek 标准的 Tools 协议格式
 */
export function getOpenAIToolsSchema() {
  return AGENT_TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}
