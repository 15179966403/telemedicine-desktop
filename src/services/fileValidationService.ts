import { FileValidationRules, FileSecurityCheckResult } from '../types/file'

export class FileValidationService {
  private static instance: FileValidationService

  // 默认验证规则
  private defaultRules: FileValidationRules = {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    allowedExtensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.pdf',
      '.txt',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
    ],
    maxFiles: 10,
  }

  // 危险文件扩展名
  private dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.deb',
    '.pkg',
    '.dmg',
    '.iso',
    '.msi',
    '.ps1',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
  ]

  // 可疑文件头（魔数）
  private suspiciousMagicNumbers = [
    { signature: [0x4d, 0x5a], description: 'PE executable' }, // MZ header
    { signature: [0x7f, 0x45, 0x4c, 0x46], description: 'ELF executable' },
    { signature: [0xca, 0xfe, 0xba, 0xbe], description: 'Java class file' },
    { signature: [0xfe, 0xed, 0xfa, 0xce], description: 'Mach-O executable' },
  ]

  static getInstance(): FileValidationService {
    if (!FileValidationService.instance) {
      FileValidationService.instance = new FileValidationService()
    }
    return FileValidationService.instance
  }

  /**
   * 验证文件
   */
  async validateFile(
    file: File,
    rules?: Partial<FileValidationRules>
  ): Promise<void> {
    const validationRules = { ...this.defaultRules, ...rules }

    // 基础验证
    this.validateBasicProperties(file, validationRules)

    // 文件内容验证
    await this.validateFileContent(file)

    // 安全检查
    const securityResult = await this.performSecurityCheck(file)
    if (!securityResult.safe) {
      throw new Error(`文件安全检查失败: ${securityResult.reason}`)
    }
  }

  /**
   * 验证基础属性
   */
  private validateBasicProperties(
    file: File,
    rules: FileValidationRules
  ): void {
    // 文件大小验证
    if (file.size > rules.maxSize) {
      const maxSizeMB = Math.round(rules.maxSize / (1024 * 1024))
      throw new Error(`文件大小不能超过 ${maxSizeMB}MB`)
    }

    if (file.size === 0) {
      throw new Error('文件不能为空')
    }

    // 文件类型验证
    if (!rules.allowedTypes.includes(file.type)) {
      throw new Error(`不支持的文件类型: ${file.type}`)
    }

    // 文件扩展名验证
    const extension = this.getFileExtension(file.name)
    if (!rules.allowedExtensions.includes(extension)) {
      throw new Error(`不支持的文件扩展名: ${extension}`)
    }

    // 文件名验证
    this.validateFileName(file.name)
  }

  /**
   * 验证文件名
   */
  private validateFileName(fileName: string): void {
    // 文件名长度检查
    if (fileName.length > 255) {
      throw new Error('文件名过长，不能超过255个字符')
    }

    if (fileName.length === 0) {
      throw new Error('文件名不能为空')
    }

    // 非法字符检查
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(fileName)) {
      throw new Error('文件名包含非法字符')
    }

    // 保留名称检查 (Windows)
    const reservedNames = [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ]

    const nameWithoutExt = fileName.split('.')[0].toUpperCase()
    if (reservedNames.includes(nameWithoutExt)) {
      throw new Error('文件名使用了系统保留名称')
    }

    // 危险扩展名检查
    const extension = this.getFileExtension(fileName)
    if (this.dangerousExtensions.includes(extension.toLowerCase())) {
      throw new Error(`危险的文件扩展名: ${extension}`)
    }
  }

  /**
   * 验证文件内容
   */
  private async validateFileContent(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = event => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          if (!arrayBuffer) {
            reject(new Error('无法读取文件内容'))
            return
          }

          // 验证文件头
          this.validateFileHeader(
            new Uint8Array(arrayBuffer),
            file.type,
            file.name
          )

          // 检查文件完整性
          this.validateFileIntegrity(new Uint8Array(arrayBuffer), file.type)

          resolve()
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('读取文件失败'))
      }

      // 只读取前1KB用于验证
      const blob = file.slice(0, 1024)
      reader.readAsArrayBuffer(blob)
    })
  }

  /**
   * 验证文件头（魔数）
   */
  private validateFileHeader(
    bytes: Uint8Array,
    mimeType: string,
    fileName: string
  ): void {
    if (bytes.length === 0) {
      throw new Error('文件内容为空')
    }

    // 检查是否为可疑的可执行文件
    for (const magic of this.suspiciousMagicNumbers) {
      if (this.matchesMagicNumber(bytes, magic.signature)) {
        throw new Error(`检测到可疑文件类型: ${magic.description}`)
      }
    }

    // 验证常见文件类型的魔数
    const extension = this.getFileExtension(fileName).toLowerCase()

    switch (extension) {
      case '.jpg':
      case '.jpeg':
        if (!this.matchesMagicNumber(bytes, [0xff, 0xd8, 0xff])) {
          throw new Error('JPEG文件头验证失败')
        }
        break

      case '.png':
        if (
          !this.matchesMagicNumber(
            bytes,
            [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
          )
        ) {
          throw new Error('PNG文件头验证失败')
        }
        break

      case '.gif':
        if (
          !this.matchesMagicNumber(bytes, [0x47, 0x49, 0x46, 0x38]) &&
          !this.matchesMagicNumber(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
        ) {
          throw new Error('GIF文件头验证失败')
        }
        break

      case '.pdf':
        if (!this.matchesMagicNumber(bytes, [0x25, 0x50, 0x44, 0x46])) {
          // %PDF
          throw new Error('PDF文件头验证失败')
        }
        break
    }
  }

  /**
   * 验证文件完整性
   */
  private validateFileIntegrity(bytes: Uint8Array, mimeType: string): void {
    // 检查文件是否被截断或损坏
    if (mimeType.startsWith('image/')) {
      // 对于图片文件，检查是否有基本的结构
      if (bytes.length < 10) {
        throw new Error('图片文件可能已损坏')
      }
    }

    // 检查是否包含恶意脚本
    const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (this.containsMaliciousScript(content)) {
      throw new Error('文件包含可疑脚本内容')
    }
  }

  /**
   * 执行安全检查
   */
  async performSecurityCheck(file: File): Promise<FileSecurityCheckResult> {
    const result: FileSecurityCheckResult = {
      safe: true,
      threats: [],
      warnings: [],
      blocked: false,
    }

    try {
      // 文件名安全检查
      const extension = this.getFileExtension(file.name).toLowerCase()
      if (this.dangerousExtensions.includes(extension)) {
        result.threats.push(`危险的文件扩展名: ${extension}`)
        result.safe = false
        result.blocked = true
        result.reason = '文件类型被禁止'
      }

      // 文件大小异常检查
      if (file.size > 100 * 1024 * 1024) {
        // 100MB
        result.warnings.push('文件大小异常大，请确认文件内容')
      }

      // MIME类型与扩展名不匹配检查
      if (!this.mimeTypeMatchesExtension(file.type, extension)) {
        result.warnings.push('文件类型与扩展名不匹配')
      }

      // 文件内容安全检查
      const contentCheck = await this.checkFileContentSecurity(file)
      if (!contentCheck.safe) {
        result.threats.push(...contentCheck.threats)
        result.safe = false
        result.blocked = true
        result.reason = '文件内容包含安全威胁'
      }
    } catch (error) {
      result.warnings.push('安全检查过程中发生错误')
    }

    return result
  }

  /**
   * 检查文件内容安全性
   */
  private async checkFileContentSecurity(
    file: File
  ): Promise<{ safe: boolean; threats: string[] }> {
    return new Promise(resolve => {
      const reader = new FileReader()

      reader.onload = event => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const bytes = new Uint8Array(arrayBuffer)
          const threats: string[] = []

          // 检查可执行文件特征
          for (const magic of this.suspiciousMagicNumbers) {
            if (this.matchesMagicNumber(bytes, magic.signature)) {
              threats.push(`检测到可执行文件特征: ${magic.description}`)
            }
          }

          // 检查脚本内容
          const content = new TextDecoder('utf-8', { fatal: false }).decode(
            bytes
          )
          if (this.containsMaliciousScript(content)) {
            threats.push('检测到可疑脚本内容')
          }

          resolve({
            safe: threats.length === 0,
            threats,
          })
        } catch (error) {
          resolve({ safe: true, threats: [] })
        }
      }

      reader.onerror = () => {
        resolve({ safe: true, threats: [] })
      }

      // 读取前10KB用于安全检查
      const blob = file.slice(0, 10240)
      reader.readAsArrayBuffer(blob)
    })
  }

  /**
   * 检查是否包含恶意脚本
   */
  private containsMaliciousScript(content: string): boolean {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /eval\s*\(/gi,
      /document\.write/gi,
      /window\.location/gi,
    ]

    return maliciousPatterns.some(pattern => pattern.test(content))
  }

  /**
   * 检查魔数是否匹配
   */
  private matchesMagicNumber(bytes: Uint8Array, signature: number[]): boolean {
    if (bytes.length < signature.length) {
      return false
    }

    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        return false
      }
    }

    return true
  }

  /**
   * 检查MIME类型与扩展名是否匹配
   */
  private mimeTypeMatchesExtension(
    mimeType: string,
    extension: string
  ): boolean {
    const mimeExtensionMap: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    }

    const expectedExtensions = mimeExtensionMap[mimeType]
    return expectedExtensions ? expectedExtensions.includes(extension) : true
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex === -1
      ? ''
      : fileName.substring(lastDotIndex).toLowerCase()
  }

  /**
   * 获取默认验证规则
   */
  getDefaultRules(): FileValidationRules {
    return { ...this.defaultRules }
  }

  /**
   * 更新默认验证规则
   */
  updateDefaultRules(rules: Partial<FileValidationRules>): void {
    this.defaultRules = { ...this.defaultRules, ...rules }
  }
}
