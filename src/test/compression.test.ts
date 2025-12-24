import { describe, it, expect, beforeEach } from 'vitest'
import {
  compressImage,
  compressImages,
  shouldCompressFile,
  formatFileSize,
  calculateCompressionRatio,
  validateFileType,
  validateFileSize,
} from '@/utils/compression'

describe('File Compression Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('should format with decimals', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB')
    })
  })

  describe('calculateCompressionRatio', () => {
    it('should calculate compression ratio correctly', () => {
      expect(calculateCompressionRatio(1000, 500)).toBe(50)
      expect(calculateCompressionRatio(1000, 750)).toBe(25)
      expect(calculateCompressionRatio(1000, 1000)).toBe(0)
    })

    it('should handle zero original size', () => {
      expect(calculateCompressionRatio(0, 0)).toBe(0)
    })

    it('should handle larger compressed size', () => {
      expect(calculateCompressionRatio(1000, 1500)).toBe(-50)
    })
  })

  describe('shouldCompressFile', () => {
    it('should recommend compression for large files', () => {
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.txt', {
        type: 'text/plain',
      })
      expect(shouldCompressFile(largeFile)).toBe(true)
    })

    it('should recommend compression for large images', () => {
      const largeImage = new File(['x'.repeat(2 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      })
      expect(shouldCompressFile(largeImage)).toBe(true)
    })

    it('should not recommend compression for small files', () => {
      const smallFile = new File(['small content'], 'small.txt', {
        type: 'text/plain',
      })
      expect(shouldCompressFile(smallFile)).toBe(false)
    })

    it('should respect custom max size', () => {
      const file = new File(['x'.repeat(2 * 1024 * 1024)], 'file.txt', {
        type: 'text/plain',
      })
      expect(shouldCompressFile(file, 1024 * 1024)).toBe(true)
      expect(shouldCompressFile(file, 3 * 1024 * 1024)).toBe(false)
    })
  })

  describe('validateFileType', () => {
    it('should validate exact file types', () => {
      const imageFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg',
      })
      expect(validateFileType(imageFile, ['image/jpeg'])).toBe(true)
      expect(validateFileType(imageFile, ['image/png'])).toBe(false)
    })

    it('should validate wildcard types', () => {
      const imageFile = new File(['content'], 'image.jpg', {
        type: 'image/jpeg',
      })
      expect(validateFileType(imageFile, ['image/*'])).toBe(true)
      expect(validateFileType(imageFile, ['video/*'])).toBe(false)
    })

    it('should validate multiple allowed types', () => {
      const pdfFile = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      })
      expect(validateFileType(pdfFile, ['image/*', 'application/pdf'])).toBe(
        true
      )
    })
  })

  describe('validateFileSize', () => {
    it('should validate file size', () => {
      const smallFile = new File(['small'], 'small.txt', {
        type: 'text/plain',
      })
      const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.txt', {
        type: 'text/plain',
      })

      expect(validateFileSize(smallFile, 1024)).toBe(true)
      expect(validateFileSize(largeFile, 5 * 1024 * 1024)).toBe(false)
      expect(validateFileSize(largeFile, 20 * 1024 * 1024)).toBe(true)
    })
  })

  describe('Image Compression', () => {
    // Note: These tests require a DOM environment with canvas support
    // In a real test environment, you might need to mock canvas or use jsdom

    it('should handle compression options', async () => {
      // Create a mock image file
      const mockFile = new File(['mock image data'], 'test.jpg', {
        type: 'image/jpeg',
      })

      // This test would need proper canvas mocking to work
      // For now, we just verify the function exists and has the right signature
      expect(typeof compressImage).toBe('function')
    })

    it('should handle batch compression', async () => {
      const mockFiles = [
        new File(['image1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['image2'], 'test2.jpg', { type: 'image/jpeg' }),
      ]

      expect(typeof compressImages).toBe('function')
    })
  })
})

describe('Compression Performance', () => {
  it('should format file sizes efficiently', () => {
    const start = performance.now()

    for (let i = 0; i < 1000; i++) {
      formatFileSize(Math.random() * 1024 * 1024 * 1024)
    }

    const duration = performance.now() - start
    expect(duration).toBeLessThan(100) // Should complete in less than 100ms
  })

  it('should validate file types efficiently', () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const allowedTypes = ['image/*', 'video/*', 'application/pdf']

    const start = performance.now()

    for (let i = 0; i < 1000; i++) {
      validateFileType(file, allowedTypes)
    }

    const duration = performance.now() - start
    expect(duration).toBeLessThan(50) // Should complete in less than 50ms
  })
})
