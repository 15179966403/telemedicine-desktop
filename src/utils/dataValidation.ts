/**
 * 数据验证工具函数
 * Data validation utility functions
 */

import {
  LoginCredentials,
  Patient,
  Message,
  SendMessageRequest,
  PatientQuery,
  WindowConfig,
  ValidationError,
  ValidationViolation,
} from '../types'

// 验证结果接口
export interface ValidationResult {
  isValid: boolean
  errors: ValidationViolation[]
}

// 通用验证函数
export class DataValidator {
  // 验证登录凭证
  static validateLoginCredentials(
    credentials: LoginCredentials
  ): ValidationResult {
    const errors: ValidationViolation[] = []

    if (!credentials.type) {
      errors.push({
        field: 'type',
        message: '登录类型不能为空',
        code: 'REQUIRED',
      })
    }

    switch (credentials.type) {
      case 'password':
        if (!credentials.username) {
          errors.push({
            field: 'username',
            message: '用户名不能为空',
            code: 'REQUIRED',
          })
        }
        if (!credentials.password) {
          errors.push({
            field: 'password',
            message: '密码不能为空',
            code: 'REQUIRED',
          })
        } else if (credentials.password.length < 6) {
          errors.push({
            field: 'password',
            message: '密码长度不能少于6位',
            code: 'MIN_LENGTH',
          })
        }
        break

      case 'sms':
        if (!credentials.phone) {
          errors.push({
            field: 'phone',
            message: '手机号不能为空',
            code: 'REQUIRED',
          })
        } else if (!this.isValidPhone(credentials.phone)) {
          errors.push({
            field: 'phone',
            message: '手机号格式不正确',
            code: 'INVALID_FORMAT',
          })
        }
        if (!credentials.smsCode) {
          errors.push({
            field: 'smsCode',
            message: '验证码不能为空',
            code: 'REQUIRED',
          })
        } else if (!/^\d{6}$/.test(credentials.smsCode)) {
          errors.push({
            field: 'smsCode',
            message: '验证码必须是6位数字',
            code: 'INVALID_FORMAT',
          })
        }
        break

      case 'realname':
        if (!credentials.idCard) {
          errors.push({
            field: 'idCard',
            message: '身份证号不能为空',
            code: 'REQUIRED',
          })
        } else if (!this.isValidIdCard(credentials.idCard)) {
          errors.push({
            field: 'idCard',
            message: '身份证号格式不正确',
            code: 'INVALID_FORMAT',
          })
        }
        break
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证患者信息
  static validatePatient(patient: Partial<Patient>): ValidationResult {
    const errors: ValidationViolation[] = []

    if (!patient.name || patient.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: '患者姓名不能为空',
        code: 'REQUIRED',
      })
    } else if (patient.name.length > 50) {
      errors.push({
        field: 'name',
        message: '患者姓名不能超过50个字符',
        code: 'MAX_LENGTH',
      })
    }

    if (patient.age !== undefined) {
      if (patient.age < 0 || patient.age > 150) {
        errors.push({
          field: 'age',
          message: '年龄必须在0-150之间',
          code: 'OUT_OF_RANGE',
        })
      }
    }

    if (!patient.gender) {
      errors.push({
        field: 'gender',
        message: '性别不能为空',
        code: 'REQUIRED',
      })
    } else if (!['male', 'female'].includes(patient.gender)) {
      errors.push({
        field: 'gender',
        message: '性别值无效',
        code: 'INVALID_VALUE',
      })
    }

    if (!patient.phone) {
      errors.push({
        field: 'phone',
        message: '手机号不能为空',
        code: 'REQUIRED',
      })
    } else if (!this.isValidPhone(patient.phone)) {
      errors.push({
        field: 'phone',
        message: '手机号格式不正确',
        code: 'INVALID_FORMAT',
      })
    }

    if (patient.idCard && !this.isValidIdCard(patient.idCard)) {
      errors.push({
        field: 'idCard',
        message: '身份证号格式不正确',
        code: 'INVALID_FORMAT',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证消息发送请求
  static validateSendMessageRequest(
    request: SendMessageRequest
  ): ValidationResult {
    const errors: ValidationViolation[] = []

    if (!request.consultationId) {
      errors.push({
        field: 'consultationId',
        message: '问诊ID不能为空',
        code: 'REQUIRED',
      })
    }

    if (!request.type) {
      errors.push({
        field: 'type',
        message: '消息类型不能为空',
        code: 'REQUIRED',
      })
    } else if (
      !['text', 'image', 'voice', 'file', 'template'].includes(request.type)
    ) {
      errors.push({
        field: 'type',
        message: '消息类型无效',
        code: 'INVALID_VALUE',
      })
    }

    if (request.type === 'text' || request.type === 'template') {
      if (!request.content || request.content.trim().length === 0) {
        errors.push({
          field: 'content',
          message: '消息内容不能为空',
          code: 'REQUIRED',
        })
      } else if (request.content.length > 5000) {
        errors.push({
          field: 'content',
          message: '消息内容不能超过5000个字符',
          code: 'MAX_LENGTH',
        })
      }
    }

    if (['image', 'voice', 'file'].includes(request.type) && !request.fileId) {
      errors.push({
        field: 'fileId',
        message: '文件ID不能为空',
        code: 'REQUIRED',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证患者查询参数
  static validatePatientQuery(query: PatientQuery): ValidationResult {
    const errors: ValidationViolation[] = []

    if (query.page < 1) {
      errors.push({
        field: 'page',
        message: '页码必须大于0',
        code: 'MIN_VALUE',
      })
    }

    if (query.pageSize < 1 || query.pageSize > 100) {
      errors.push({
        field: 'pageSize',
        message: '每页数量必须在1-100之间',
        code: 'OUT_OF_RANGE',
      })
    }

    if (query.ageRange) {
      if (query.ageRange.min < 0 || query.ageRange.max > 150) {
        errors.push({
          field: 'ageRange',
          message: '年龄范围必须在0-150之间',
          code: 'OUT_OF_RANGE',
        })
      }
      if (query.ageRange.min > query.ageRange.max) {
        errors.push({
          field: 'ageRange',
          message: '最小年龄不能大于最大年龄',
          code: 'INVALID_RANGE',
        })
      }
    }

    if (query.gender && !['male', 'female'].includes(query.gender)) {
      errors.push({
        field: 'gender',
        message: '性别值无效',
        code: 'INVALID_VALUE',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证窗口配置
  static validateWindowConfig(config: WindowConfig): ValidationResult {
    const errors: ValidationViolation[] = []

    if (!config.type) {
      errors.push({
        field: 'type',
        message: '窗口类型不能为空',
        code: 'REQUIRED',
      })
    }

    if (!config.title || config.title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: '窗口标题不能为空',
        code: 'REQUIRED',
      })
    }

    if (!config.url || config.url.trim().length === 0) {
      errors.push({
        field: 'url',
        message: '窗口URL不能为空',
        code: 'REQUIRED',
      })
    }

    if (config.width !== undefined && config.width < 200) {
      errors.push({
        field: 'width',
        message: '窗口宽度不能小于200px',
        code: 'MIN_VALUE',
      })
    }

    if (config.height !== undefined && config.height < 150) {
      errors.push({
        field: 'height',
        message: '窗口高度不能小于150px',
        code: 'MIN_VALUE',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证文件类型
  static validateFileType(
    file: File,
    allowedTypes: string[]
  ): ValidationResult {
    const errors: ValidationViolation[] = []

    if (!allowedTypes.includes(file.type)) {
      errors.push({
        field: 'type',
        message: `不支持的文件类型: ${file.type}`,
        code: 'UNSUPPORTED_TYPE',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 验证文件大小
  static validateFileSize(file: File, maxSize: number): ValidationResult {
    const errors: ValidationViolation[] = []

    if (file.size > maxSize) {
      errors.push({
        field: 'size',
        message: `文件大小超过限制: ${this.formatFileSize(file.size)} > ${this.formatFileSize(maxSize)}`,
        code: 'FILE_TOO_LARGE',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // 辅助方法：验证手机号
  private static isValidPhone(phone: string): boolean {
    return /^1[3-9]\d{9}$/.test(phone)
  }

  // 辅助方法：验证身份证号
  private static isValidIdCard(idCard: string): boolean {
    return /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(
      idCard
    )
  }

  // 辅助方法：格式化文件大小
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 创建验证错误
  static createValidationError(
    violations: ValidationViolation[]
  ): ValidationError {
    return {
      type: 'VALIDATION_ERROR',
      message: '数据验证失败',
      violations,
      timestamp: new Date(),
    }
  }
}
