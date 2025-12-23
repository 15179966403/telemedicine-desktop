// 数据验证工具函数

/**
 * 验证手机号
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证邮箱
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证身份证号
 */
export function validateIdCard(idCard: string): boolean {
  const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/
  return idCardRegex.test(idCard)
}

/**
 * 验证密码强度
 */
export function validatePassword(password: string): {
  isValid: boolean
  strength: 'weak' | 'medium' | 'strong'
  errors: string[]
} {
  const errors: string[] = []
  let score = 0

  if (password.length < 8) {
    errors.push('密码长度至少8位')
  } else {
    score += 1
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  } else {
    score += 1
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  } else {
    score += 1
  }

  if (!/\d/.test(password)) {
    errors.push('密码必须包含数字')
  } else {
    score += 1
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含特殊字符')
  } else {
    score += 1
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  if (score >= 4) {
    strength = 'strong'
  } else if (score >= 2) {
    strength = 'medium'
  }

  return {
    isValid: errors.length === 0,
    strength,
    errors,
  }
}

/**
 * 验证用户名
 */
export function validateUsername(username: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!username) {
    errors.push('用户名不能为空')
  }

  if (username.length < 3) {
    errors.push('用户名长度至少3位')
  }

  if (username.length > 20) {
    errors.push('用户名长度不能超过20位')
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('用户名只能包含字母、数字和下划线')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 验证文件类型
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type)
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize
}

/**
 * 验证年龄
 */
export function validateAge(age: number): boolean {
  return age >= 0 && age <= 150 && Number.isInteger(age)
}

/**
 * 验证日期
 */
export function validateDate(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * 验证URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 验证IP地址
 */
export function validateIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * 验证中文姓名
 */
export function validateChineseName(name: string): boolean {
  const chineseNameRegex = /^[\u4e00-\u9fa5]{2,10}$/
  return chineseNameRegex.test(name)
}

/**
 * 验证医生执业证号
 */
export function validateDoctorLicense(license: string): boolean {
  // 医生执业证号通常为15位数字
  const licenseRegex = /^\d{15}$/
  return licenseRegex.test(license)
}

/**
 * 验证医院代码
 */
export function validateHospitalCode(code: string): boolean {
  // 医院代码通常为8-12位字母数字组合
  const codeRegex = /^[A-Z0-9]{8,12}$/
  return codeRegex.test(code)
}

/**
 * 验证科室代码
 */
export function validateDepartmentCode(code: string): boolean {
  // 科室代码通常为3-6位字母数字组合
  const codeRegex = /^[A-Z0-9]{3,6}$/
  return codeRegex.test(code)
}

/**
 * 验证消息内容
 */
export function validateMessageContent(content: string, maxLength: number = 5000): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!content || content.trim().length === 0) {
    errors.push('消息内容不能为空')
  }

  if (content.length > maxLength) {
    errors.push(`消息内容不能超过${maxLength}个字符`)
  }

  // 检查是否包含敏感词（这里只是示例）
  const sensitiveWords = ['测试敏感词']
  const hasSensitiveWord = sensitiveWords.some(word => content.includes(word))
  if (hasSensitiveWord) {
    errors.push('消息内容包含敏感词')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 验证标签
 */
export function validateTag(tag: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!tag || tag.trim().length === 0) {
    errors.push('标签不能为空')
  }

  if (tag.length > 20) {
    errors.push('标签长度不能超过20个字符')
  }

  if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(tag)) {
    errors.push('标签只能包含中文、字母和数字')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 通用表单验证
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  rules: Record<keyof T, (value: any) => { isValid: boolean; errors: string[] }>
): {
  isValid: boolean
  errors: Record<keyof T, string[]>
} {
  const errors = {} as Record<keyof T, string[]>
  let isValid = true

  for (const [field, rule] of Object.entries(rules)) {
    const result = rule(data[field])
    if (!result.isValid) {
      errors[field as keyof T] = result.errors
      isValid = false
    }
  }

  return { isValid, errors }
}