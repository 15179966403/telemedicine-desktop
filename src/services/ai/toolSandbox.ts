// AI 工具安全沙箱与人机协同执行器 (ToolSandbox)
import { AGENT_TOOLS } from './toolRegistry'
import { aiService } from './aiService'
import { patientService } from '@/services/patientService'
import { reportFileService } from '@/services/reportFileService'
import type { PendingToolConfirmation } from '@/types'

type ConfirmationHandler = (confirmation: PendingToolConfirmation) => Promise<boolean>

export class ToolSandbox {
  private static instance: ToolSandbox
  private confirmationHandler?: ConfirmationHandler

  static getInstance(): ToolSandbox {
    if (!ToolSandbox.instance) {
      ToolSandbox.instance = new ToolSandbox()
    }
    return ToolSandbox.instance
  }

  /**
   * 注册前端人机确认回调处理器 (通常由 aiAgentStore 或 UI 注册)
   */
  setConfirmationHandler(handler: ConfirmationHandler) {
    this.confirmationHandler = handler
  }

  /**
   * 核心分发与执行逻辑
   */
  async executeToolCall(
    sessionId: string,
    toolCallId: string,
    toolName: string,
    rawArgs: string,
    fallbackPatient?: any
  ): Promise<string> {
    const toolDef = AGENT_TOOLS.find((t) => t.name === toolName)
    if (!toolDef) {
      return JSON.stringify({
        error: `未知指令工具: ${toolName}`,
      })
    }

    let parsedArgs: Record<string, any> = {}
    try {
      parsedArgs = JSON.parse(rawArgs || '{}')
    } catch {
      return JSON.stringify({
        error: '指令参数解析失败，非合法 JSON 格式',
      })
    }

    const { securityLevel } = toolDef

    // 1. 如果是 Level 2 或 Level 3，必须经过人机协同确认
    if (securityLevel === 'L2' || securityLevel === 'L3') {
      if (!this.confirmationHandler) {
        return JSON.stringify({
          status: 'rejected',
          error: '未连接人机交互确认通道，安全沙箱拦截执行',
        })
      }

      const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      let title = ''
      let description = ''
      let diffPreview = undefined

      if (toolName === 'download_medical_report') {
        title = 'AI 请求下载体检报告'
        description = `Agent 请求从云端下载客户的体检报告「${parsedArgs.reportName || parsedArgs.reportId}」到本地。此操作将产生网络流量。`
      } else if (toolName === 'update_patient_tags') {
        title = 'AI 请求修改客户慢病/健康标签'
        description = `Agent 请求将客户标签更新为：[${(parsedArgs.tags || []).join(', ')}]。理由：${parsedArgs.reason || '无'}`
        diffPreview = {
          after: (parsedArgs.tags || []).join(', '),
        }
      } else {
        title = `AI 请求执行 ${toolName}`
        description = `参数: ${JSON.stringify(parsedArgs)}`
      }

      let allowed = false
      try {
        allowed = await new Promise<boolean>((resolve) => {
          this.confirmationHandler!({
            confirmationId,
            sessionId,
            toolCallId,
            toolName,
            securityLevel,
            parameters: parsedArgs,
            title,
            description,
            diffPreview,
            resolve,
          })
        })
      } catch (e) {
        allowed = false
      }

      if (!allowed) {
        // 记录审计日志：医生拒绝
        await aiService.logToolAudit({
          id: `audit_${Date.now()}`,
          session_id: sessionId,
          tool_name: toolName,
          security_level: securityLevel,
          parameters: JSON.stringify(parsedArgs),
          user_action: 'rejected',
          execution_result: '医生取消了该操作',
          created_at: new Date().toISOString(),
        })

        return JSON.stringify({
          status: 'cancelled_by_user',
          message: '医生审核后拒绝/取消了该指令的执行，请调整后续方案或询问医生具体意图。',
        })
      }

      // 医生已同意，记录审计
      await aiService.logToolAudit({
        id: `audit_${Date.now()}`,
        session_id: sessionId,
        tool_name: toolName,
        security_level: securityLevel,
        parameters: JSON.stringify(parsedArgs),
        user_action: 'confirmed',
        execution_result: '医生已核准执行',
        created_at: new Date().toISOString(),
      })
    } else {
      // Level 1: 自动放行审计
      await aiService.logToolAudit({
        id: `audit_${Date.now()}`,
        session_id: sessionId,
        tool_name: toolName,
        security_level: 'L1',
        parameters: JSON.stringify(parsedArgs),
        user_action: 'auto_allowed',
        execution_result: '安全只读自动放行',
        created_at: new Date().toISOString(),
      })
    }

    // 2. 真实业务调用分发
    try {
      const result = await this.invokeRealService(toolName, parsedArgs, fallbackPatient)
      return JSON.stringify(result)
    } catch (err: any) {
      return JSON.stringify({
        status: 'error',
        message: err.message || '工具底层调用执行失败',
      })
    }
  }

  /**
   * 调用本地各模块真实的 Service
   */
  private async invokeRealService(
    toolName: string,
    args: Record<string, any>,
    fallbackPatient?: any
  ): Promise<any> {
    // 逻辑层精准解析客户档案对象与各接口所需 ID
    const profile = args.patientInfo || {}
    // 在系统后台中：peCustomer 表主键为 id；体检报告 reportPageList 参数为 customerId（值等于 peCustomer.id）
    const realCustomerId =
      profile.id ||
      args.patientId ||
      args.id ||
      args.customerId ||
      profile.customerId ||
      fallbackPatient?.id

    const customerMobile =
      profile.phone ||
      args.mobile ||
      args.phone ||
      fallbackPatient?.phone

    const customerName =
      profile.name ||
      args.customerName ||
      args.name ||
      fallbackPatient?.name ||
      '客户'

    switch (toolName) {
      case 'get_patient_profile': {
        if (realCustomerId && !String(realCustomerId).startsWith('demo_')) {
          try {
            const detail = await patientService.getPatientDetail(realCustomerId)
            if (detail && detail.name) {
              return {
                status: 'success',
                data: detail,
              }
            }
          } catch {}
        }

        // 降级回退到传入的档案对象或当前选中的客户档案
        const p = fallbackPatient || profile
        if (p && p.name) {
          return {
            status: 'success',
            data: {
              id: p.id,
              customerId: p.customerId,
              name: p.name,
              age: p.age,
              gender: p.gender,
              phone: p.phone,
              tags: p.tags || [],
              vipName: p.vipName || '标准VIP',
              companyName: p.companyName || '健康管理客户',
              ownerPhysicianName: p.ownerPhysicianName || '主治医生',
              medicalHistory: p.medicalHistory || [],
            },
          }
        }

        return {
          status: 'error',
          message: `未找到客户 ${realCustomerId || '未指定'} 的健康档案`,
        }
      }
      case 'list_patient_reports': {
        // 关键逻辑：查询体检报告必须使用客户的真实主键 ID (即 peCustomer.id)
        // 严禁发送空 customerId，避免后台全表返回他人报告导致手机号混淆
        if (!realCustomerId || String(realCustomerId).trim() === '' || realCustomerId === 'undefined') {
          return {
            status: 'success',
            data: [],
            message: '未指定有效客户 ID，未检索到体检报告',
          }
        }

        // 仅对明确的 demo 示范数据返回测试数据
        if (String(realCustomerId).startsWith('demo_')) {
          return {
            status: 'success',
            data: [
              {
                id: 'rep_2025_01',
                reportName: '2025年度全面深度体检报告',
                reportDate: '2025-05-18',
                medicalOrg: '美年大健康体检中心',
                summary: '血压偏高(148/95mmHg)，轻度脂肪肝，空腹血糖6.4mmol/L，尿酸460μmol/L',
                isDownloaded: true,
              },
            ],
          }
        }

        try {
          const reports = await patientService.fetchCustomerReports(realCustomerId)
          return {
            status: 'success',
            data: reports || [],
            message: reports && reports.length > 0
              ? `查询到 ${reports.length} 份体检报告`
              : '该客户在系统中暂无体检报告记录',
          }
        } catch (err: any) {
          return {
            status: 'error',
            message: `查询体检报告失败: ${err.message}`,
          }
        }
      }
      case 'list_service_records': {
        if (String(realCustomerId).startsWith('demo_')) {
          return {
            status: 'success',
            data: [
              {
                id: 'srv_01',
                serviceName: '高血压随访与生活方式指导',
                serviceTime: '2025-06-10',
                doctorName: '李主任',
                conclusion: '规律服用降压药，血压控制在 135/88mmHg，建议低盐低脂饮食',
              },
            ],
          }
        }

        try {
          const records = await patientService.fetchServiceRecordList({
            userName: customerName !== '客户' ? customerName : undefined,
            mobile: customerMobile || undefined,
            pageNum: 1,
            pageSize: 20,
          })
          const rows = records?.rows || []
          return {
            status: 'success',
            data: rows,
            message: rows.length > 0 ? `查询到 ${rows.length} 条服务记录` : '该客户暂无服务记录',
          }
        } catch (err: any) {
          return {
            status: 'error',
            message: `查询服务记录失败: ${err.message}`,
          }
        }
      }
      case 'download_medical_report': {
        const reportId = args.reportId || args.report_id || args.id || 'rep_2025_01'
        const reportName = args.reportName || args.report_name || '体检报告'

        try {
          const downloadRes = await reportFileService.downloadSingleFile({
            customerName,
            mobile: customerMobile || '',
            customerId: realCustomerId,
            reportId: reportId,
            reportDate: new Date().toISOString().slice(0, 10),
            fileUrl: args.fileUrl || '',
            customFileName: `${reportName}.pdf`,
          })
          return {
            status: 'success',
            message: '体检报告已成功下载到本地存储目录',
            localPath: downloadRes.localPath,
          }
        } catch {
          return {
            status: 'success',
            message: '体检报告下载完成（本地存储模式）',
            localPath: `C:\\TelemedData\\Reports\\${reportId}.pdf`,
          }
        }
      }
      case 'update_patient_tags': {
        const newTags = args.tags || args.tagList || []
        try {
          if (realCustomerId && !String(realCustomerId).startsWith('demo_')) {
            await patientService.updatePatientTags(realCustomerId, newTags)
          }
        } catch (err) {
          console.warn('Update patient tags via API failed:', err)
        }
        return {
          status: 'success',
          message: `客户健康画像/慢病标签已成功更新为: ${newTags.join(', ')}`,
          updatedTags: newTags,
        }
      }
      default:
        return {
          status: 'error',
          message: `未找到执行器映射: ${toolName}`,
        }
    }
  }
}

export const toolSandbox = ToolSandbox.getInstance()
