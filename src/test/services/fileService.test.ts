import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FileService } from '../../services/fileService'
import { FileValidationService } from '../../services/fileValidationService'
import { FileStorageService } from '../../services/fileStorageService'
import { FileCacheService } from '../../services/fileCacheService'

// Mock the services
vi.mock('../../services/fileValidationService')
vi.mock('../../services/fileStorageService')
vi.mock('../../services/fileCacheService')

describe('FileService', () => {
  let fileService: FileService
  let mockValidationService: any
  let mockStorageService: any
  let mockCacheService: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create mock instances
    mockValidationService = {
      validateFile: vi.fn(),
    }

    mockStorageService = {
      saveFileLocally: vi.fn(),
      deleteLocalFile: vi.fn(),
    }

    mockCacheService = {
      addToCache: vi.fn(),
      removeFromCache: vi.fn(),
      isInCache: vi.fn(),
      getFromCache: vi.fn(),
      performCleanup: vi.fn(),
      getCacheStatistics: vi.fn(),
      clearAllCache: vi.fn(),
    }

    // Mock the getInstance methods
    vi.mocked(FileValidationService.getInstance).mockReturnValue(
      mockValidationService
    )
    vi.mocked(FileStorageService.getInstance).mockReturnValue(
      mockStorageService
    )
    vi.mocked(FileCacheService.getInstance).mockReturnValue(mockCacheService)

    fileService = FileService.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      const mockLocalPath = '/local/path/test.txt'

      mockValidationService.validateFile.mockResolvedValue(undefined)
      mockStorageService.saveFileLocally.mockResolvedValue(mockLocalPath)
      mockCacheService.addToCache.mockResolvedValue(undefined)

      // Act
      const result = await fileService.uploadFile(mockFile)

      // Assert
      expect(mockValidationService.validateFile).toHaveBeenCalledWith(
        mockFile,
        undefined
      )
      expect(mockStorageService.saveFileLocally).toHaveBeenCalled()
      expect(mockCacheService.addToCache).toHaveBeenCalled()
      expect(result).toMatchObject({
        name: 'test.txt',
        size: mockFile.size,
        type: 'text/plain',
        localPath: mockLocalPath,
      })
      expect(result.id).toBeDefined()
      expect(result.url).toBeDefined()
      expect(result.uploadedAt).toBeInstanceOf(Date)
    })

    it('should call progress callback during upload', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      const progressCallback = vi.fn()

      mockValidationService.validateFile.mockResolvedValue(undefined)
      mockStorageService.saveFileLocally.mockResolvedValue(
        '/local/path/test.txt'
      )
      mockCacheService.addToCache.mockResolvedValue(undefined)

      // Act
      await fileService.uploadFile(mockFile, progressCallback)

      // Assert
      expect(progressCallback).toHaveBeenCalledTimes(11) // 0, 10, 20, ..., 100
      expect(progressCallback).toHaveBeenCalledWith(0)
      expect(progressCallback).toHaveBeenCalledWith(100)
    })

    it('should throw error when validation fails', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      const validationError = new Error('File validation failed')

      mockValidationService.validateFile.mockRejectedValue(validationError)

      // Act & Assert
      await expect(fileService.uploadFile(mockFile)).rejects.toThrow(
        'File validation failed'
      )
      expect(mockStorageService.saveFileLocally).not.toHaveBeenCalled()
      expect(mockCacheService.addToCache).not.toHaveBeenCalled()
    })

    it('should throw error when storage fails', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })
      const storageError = new Error('Storage failed')

      mockValidationService.validateFile.mockResolvedValue(undefined)
      mockStorageService.saveFileLocally.mockRejectedValue(storageError)

      // Act & Assert
      await expect(fileService.uploadFile(mockFile)).rejects.toThrow(
        'Storage failed'
      )
      expect(mockCacheService.addToCache).not.toHaveBeenCalled()
    })
  })

  describe('downloadFile', () => {
    it('should return cached file path when file is in cache', async () => {
      // Arrange
      const fileUrl = 'https://example.com/file.txt'
      const fileName = 'file.txt'
      const cachedPath = '/cache/file.txt'

      mockCacheService.isInCache.mockResolvedValue(true)
      mockCacheService.getFromCache.mockResolvedValue({
        localPath: cachedPath,
      })

      // Act
      const result = await fileService.downloadFile(fileUrl, fileName)

      // Assert
      expect(mockCacheService.isInCache).toHaveBeenCalledWith(fileUrl)
      expect(mockCacheService.getFromCache).toHaveBeenCalledWith(fileUrl)
      expect(result).toBe(cachedPath)
    })

    it('should download and cache file when not in cache', async () => {
      // Arrange
      const fileUrl = 'https://example.com/file.txt'
      const fileName = 'file.txt'

      mockCacheService.isInCache.mockResolvedValue(false)
      mockCacheService.addToCache.mockResolvedValue(undefined)

      // Act
      const result = await fileService.downloadFile(fileUrl, fileName)

      // Assert
      expect(mockCacheService.isInCache).toHaveBeenCalledWith(fileUrl)
      expect(mockCacheService.addToCache).toHaveBeenCalled()
      expect(result).toBe('/temp/downloads/file.txt')
    })

    it('should throw error when download fails', async () => {
      // Arrange
      const fileUrl = 'https://example.com/file.txt'
      const fileName = 'file.txt'

      mockCacheService.isInCache.mockRejectedValue(
        new Error('Cache check failed')
      )

      // Act & Assert
      await expect(fileService.downloadFile(fileUrl, fileName)).rejects.toThrow(
        '文件下载失败'
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      // Arrange
      const fileId = 'file-123'
      const mockFileInfo = {
        id: fileId,
        name: 'test.txt',
        url: 'https://example.com/test.txt',
        localPath: '/local/test.txt',
        size: 1024,
        type: 'text/plain',
        uploadedAt: new Date(),
      }

      // Mock getFileInfo method
      vi.spyOn(fileService, 'getFileInfo').mockResolvedValue(mockFileInfo)
      mockCacheService.removeFromCache.mockResolvedValue(undefined)
      mockStorageService.deleteLocalFile.mockResolvedValue(undefined)

      // Act
      await fileService.deleteFile(fileId)

      // Assert
      expect(fileService.getFileInfo).toHaveBeenCalledWith(fileId)
      expect(mockCacheService.removeFromCache).toHaveBeenCalledWith(
        mockFileInfo.url
      )
      expect(mockStorageService.deleteLocalFile).toHaveBeenCalledWith(
        mockFileInfo.localPath
      )
    })

    it('should throw error when deletion fails', async () => {
      // Arrange
      const fileId = 'file-123'

      vi.spyOn(fileService, 'getFileInfo').mockRejectedValue(
        new Error('File not found')
      )

      // Act & Assert
      await expect(fileService.deleteFile(fileId)).rejects.toThrow(
        '删除文件失败'
      )
    })
  })

  describe('cleanupExpiredFiles', () => {
    it('should cleanup expired files successfully', async () => {
      // Arrange
      const cleanupResult = { deletedFiles: 5, freedSpace: 1024000 }
      mockCacheService.performCleanup.mockResolvedValue(cleanupResult)

      // Act
      await fileService.cleanupExpiredFiles()

      // Assert
      expect(mockCacheService.performCleanup).toHaveBeenCalled()
    })

    it('should not throw error when cleanup fails', async () => {
      // Arrange
      mockCacheService.performCleanup.mockRejectedValue(
        new Error('Cleanup failed')
      )

      // Act & Assert
      await expect(fileService.cleanupExpiredFiles()).resolves.toBeUndefined()
    })
  })

  describe('getCacheStatistics', () => {
    it('should return cache statistics', async () => {
      // Arrange
      const mockStats = {
        totalFiles: 10,
        totalSize: 1024000,
        cacheHitRate: 0.85,
        uploadSuccessRate: 0.95,
        downloadSuccessRate: 0.9,
        averageUploadTime: 1500,
        averageDownloadTime: 800,
      }
      mockCacheService.getCacheStatistics.mockResolvedValue(mockStats)

      // Act
      const result = await fileService.getCacheStatistics()

      // Assert
      expect(mockCacheService.getCacheStatistics).toHaveBeenCalled()
      expect(result).toEqual(mockStats)
    })
  })

  describe('clearAllCache', () => {
    it('should clear all cache successfully', async () => {
      // Arrange
      mockCacheService.clearAllCache.mockResolvedValue(undefined)

      // Act
      await fileService.clearAllCache()

      // Assert
      expect(mockCacheService.clearAllCache).toHaveBeenCalled()
    })
  })

  describe('getFileIcon', () => {
    it('should return correct icon for image files', () => {
      expect(fileService.getFileIcon('image/jpeg')).toBe('🖼️')
      expect(fileService.getFileIcon('image/png')).toBe('🖼️')
    })

    it('should return correct icon for PDF files', () => {
      expect(fileService.getFileIcon('application/pdf')).toBe('📄')
    })

    it('should return correct icon for Word documents', () => {
      expect(fileService.getFileIcon('application/msword')).toBe('📝')
      expect(
        fileService.getFileIcon(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe('📝')
    })

    it('should return default icon for unknown file types', () => {
      expect(fileService.getFileIcon('application/unknown')).toBe('📎')
    })
  })

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(fileService.formatFileSize(0)).toBe('0 B')
      expect(fileService.formatFileSize(1024)).toBe('1 KB')
      expect(fileService.formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(fileService.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(fileService.formatFileSize(1536)).toBe('1.5 KB')
    })
  })
})
