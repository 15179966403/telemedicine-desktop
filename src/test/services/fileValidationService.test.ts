import { describe, it, expect, beforeEach } from 'vitest'
import { FileValidationService } from '../../services/fileValidationService'

describe('FileValidationService', () => {
  let validationService: FileValidationService

  beforeEach(() => {
    validationService = FileValidationService.getInstance()
  })

  describe('validateFile', () => {
    it('should validate a valid image file', async () => {
      // Arrange - Create a mock JPEG file with proper header
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
      const validImageFile = new File([jpegHeader], 'test.jpg', {
        type: 'image/jpeg',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(validImageFile)
      ).resolves.toBeUndefined()
    })

    it('should validate a valid PDF file', async () => {
      // Arrange - Create a mock PDF file with proper header
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF
      const validPdfFile = new File([pdfHeader], 'document.pdf', {
        type: 'application/pdf',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(validPdfFile)
      ).resolves.toBeUndefined()
    })

    it('should reject file that is too large', async () => {
      // Arrange
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      })

      // Act & Assert
      await expect(validationService.validateFile(largeFile)).rejects.toThrow(
        '文件大小不能超过'
      )
    })

    it('should reject empty file', async () => {
      // Arrange
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' })

      // Act & Assert
      await expect(validationService.validateFile(emptyFile)).rejects.toThrow(
        '文件不能为空'
      )
    })

    it('should reject unsupported file type', async () => {
      // Arrange
      const unsupportedFile = new File(['content'], 'test.xyz', {
        type: 'application/xyz',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(unsupportedFile)
      ).rejects.toThrow('不支持的文件类型')
    })

    it('should reject unsupported file extension', async () => {
      // Arrange
      const unsupportedExtFile = new File(['content'], 'test.exe', {
        type: 'image/jpeg',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(unsupportedExtFile)
      ).rejects.toThrow('不支持的文件扩展名')
    })

    it('should reject file with invalid filename', async () => {
      // Arrange
      const invalidNameFile = new File(['content'], 'test<>.jpg', {
        type: 'image/jpeg',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(invalidNameFile)
      ).rejects.toThrow('文件名包含非法字符')
    })

    it('should reject file with too long filename', async () => {
      // Arrange
      const longName = 'a'.repeat(256) + '.jpg'
      const longNameFile = new File(['content'], longName, {
        type: 'image/jpeg',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(longNameFile)
      ).rejects.toThrow('文件名过长')
    })

    it('should reject file with dangerous extension', async () => {
      // Arrange
      const dangerousFile = new File(['content'], 'malware.exe', {
        type: 'application/octet-stream',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(dangerousFile)
      ).rejects.toThrow('不支持的文件扩展名')
    })

    it('should reject file with reserved name', async () => {
      // Arrange
      const reservedNameFile = new File(['content'], 'CON.txt', {
        type: 'text/plain',
      })

      // Act & Assert
      await expect(
        validationService.validateFile(reservedNameFile)
      ).rejects.toThrow('文件名使用了系统保留名称')
    })

    it('should use custom validation rules', async () => {
      // Arrange
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const customRules = {
        maxSize: 1024, // 1KB
        allowedTypes: ['text/plain'],
        allowedExtensions: ['.txt'],
      }

      // Act & Assert
      await expect(
        validationService.validateFile(file, customRules)
      ).rejects.toThrow()
    })
  })

  describe('performSecurityCheck', () => {
    it('should pass security check for safe file', async () => {
      // Arrange
      const safeFile = new File(['safe content'], 'document.pdf', {
        type: 'application/pdf',
      })

      // Act
      const result = await validationService.performSecurityCheck(safeFile)

      // Assert
      expect(result.safe).toBe(true)
      expect(result.blocked).toBe(false)
      expect(result.threats).toHaveLength(0)
    })

    it('should fail security check for dangerous file extension', async () => {
      // Arrange
      const dangerousFile = new File(['content'], 'malware.exe', {
        type: 'application/octet-stream',
      })

      // Act
      const result = await validationService.performSecurityCheck(dangerousFile)

      // Assert
      expect(result.safe).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.threats).toContain('危险的文件扩展名: .exe')
      expect(result.reason).toBe('文件类型被禁止')
    })

    it('should warn about large file size', async () => {
      // Arrange
      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      })

      // Act
      const result = await validationService.performSecurityCheck(largeFile)

      // Assert
      expect(result.warnings).toContain('文件大小异常大，请确认文件内容')
    })

    it('should warn about MIME type mismatch', async () => {
      // Arrange
      const mismatchFile = new File(['content'], 'document.pdf', {
        type: 'image/jpeg',
      })

      // Act
      const result = await validationService.performSecurityCheck(mismatchFile)

      // Assert
      expect(result.warnings).toContain('文件类型与扩展名不匹配')
    })
  })

  describe('getDefaultRules', () => {
    it('should return default validation rules', () => {
      // Act
      const rules = validationService.getDefaultRules()

      // Assert
      expect(rules).toHaveProperty('maxSize')
      expect(rules).toHaveProperty('allowedTypes')
      expect(rules).toHaveProperty('allowedExtensions')
      expect(rules).toHaveProperty('maxFiles')
      expect(rules.maxSize).toBe(50 * 1024 * 1024) // 50MB
      expect(rules.maxFiles).toBe(10)
    })
  })

  describe('updateDefaultRules', () => {
    it('should update default validation rules', () => {
      // Arrange
      const newRules = {
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }

      // Act
      validationService.updateDefaultRules(newRules)
      const updatedRules = validationService.getDefaultRules()

      // Assert
      expect(updatedRules.maxSize).toBe(10 * 1024 * 1024)
      expect(updatedRules.maxFiles).toBe(5)
    })
  })
})
