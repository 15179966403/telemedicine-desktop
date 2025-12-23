import { FileValidationService } from './fileValidationService'
import { FileStorageService } from './fileStorageService'
import { FileCacheService } from './fileCacheService'
import { FileInfo, FileValidationRules } from '../types/file'

export class FileService {
  private static instance: FileService
  private validationService: FileValidationService
  private storageService: FileStorageService
  private cacheService: FileCacheService

  constructor() {
    this.validationService = FileValidationService.getInstance()
    this.storageService = FileStorageService.getInstance()
    this.cacheService = FileCacheService.getInstance()
  }

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService()
    }
    return FileService.instance
  }

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
    validationRules?: Partial<FileValidationRules>
  ): Promise<FileInfo> {
    try {
      console.log('FileService.uploadFile called with:', file.name)

      // 1. 验证文件
      await this.validationService.validateFile(file, validationRules)

      // 2. 模拟上传进度
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100))
          onProgress(i)
        }
      }

      // 3. 保存文件到本地存储
      const fileData = await this.fileToArrayBuffer(file)
      const localPath = await this.storageService.saveFileLocally(
        fileData,
        file.name
      )

      // 4. 创建文件信息
      const fileInfo: FileInfo = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `https://cdn.telemedicine.com/files/${file.name}`,
        localPath,
        uploadedAt: new Date(),
      }

      // 5. 添加到缓存
      await this.cacheService.addToCache({
        id: fileInfo.id,
        fileUrl: fileInfo.url,
        localPath,
        fileSize: file.size,
        mimeType: file.type,
        downloadedAt: new Date(),
        lastAccessed: new Date(),
      })

      return fileInfo
    } catch (error) {
      console.error('Upload file failed:', error)
      throw error
    }
  }

  async downloadFile(fileUrl: string, fileName: string): Promise<string> {
    try {
      console.log('FileService.downloadFile called with:', {
        fileUrl,
        fileName,
      })

      // 1. 检查是否在缓存中
      const isInCache = await this.cacheService.isInCache(fileUrl)
      if (isInCache) {
        const cacheInfo = await this.cacheService.getFromCache(fileUrl)
        if (cacheInfo?.localPath) {
          console.log('File found in cache:', cacheInfo.localPath)
          return cacheInfo.localPath
        }
      }

      // 2. 下载文件
      // TODO: 实现实际的文件下载逻辑，调用 Tauri API
      await new Promise(resolve => setTimeout(resolve, 800))

      // 3. 保存到本地
      const localPath = `/temp/downloads/${fileName}`

      // 4. 添加到缓存
      await this.cacheService.addToCache({
        id: `download-${Date.now()}`,
        fileUrl,
        localPath,
        downloadedAt: new Date(),
        lastAccessed: new Date(),
      })

      return localPath
    } catch (error) {
      console.error('Download file failed:', error)
      throw new Error('文件下载失败')
    }
  }

  async saveFileLocally(
    _fileData: ArrayBuffer,
    fileName: string
  ): Promise<string> {
    try {
      console.log('FileService.saveFileLocally called with:', fileName)

      // TODO: 调用 Tauri API 保存文件到本地
      // 这里需要使用 Tauri 的文件系统 API

      // 模拟保存过程
      await new Promise(resolve => setTimeout(resolve, 500))

      const localPath = `/app_data/files/${Date.now()}-${fileName}`

      return localPath
    } catch (error) {
      console.error('Save file locally failed:', error)
      throw new Error('保存文件失败')
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      console.log('FileService.deleteFile called with:', fileId)

      // 1. 获取文件信息
      const fileInfo = await this.getFileInfo(fileId)

      // 2. 从缓存中删除
      if (fileInfo.url) {
        await this.cacheService.removeFromCache(fileInfo.url)
      }

      // 3. 删除本地文件
      if (fileInfo.localPath) {
        await this.storageService.deleteLocalFile(fileInfo.localPath)
      }

      // TODO: 实现实际的文件删除逻辑
    } catch (error) {
      console.error('Delete file failed:', error)
      throw new Error('删除文件失败')
    }
  }

  async getFileInfo(fileId: string): Promise<FileInfo> {
    try {
      console.log('FileService.getFileInfo called with:', fileId)

      // 模拟获取文件信息
      await new Promise(resolve => setTimeout(resolve, 200))

      // 模拟文件信息
      const fileInfo: FileInfo = {
        id: fileId,
        name: 'example.pdf',
        size: 1024 * 1024, // 1MB
        type: 'application/pdf',
        url: `https://cdn.telemedicine.com/files/${fileId}`,
        uploadedAt: new Date(),
      }

      return fileInfo
    } catch (error) {
      console.error('Get file info failed:', error)
      throw new Error('获取文件信息失败')
    }
  }

  async cleanupExpiredFiles(): Promise<void> {
    try {
      console.log('FileService.cleanupExpiredFiles called')

      // 使用缓存服务进行清理
      const result = await this.cacheService.performCleanup()
      console.log(
        `Cleanup completed: ${result.deletedFiles} files deleted, ${result.freedSpace} bytes freed`
      )
    } catch (error) {
      console.error('Cleanup expired files failed:', error)
      // 清理失败不应该影响主要功能
    }
  }

  /**
   * 将File对象转换为ArrayBuffer
   */
  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStatistics() {
    return await this.cacheService.getCacheStatistics()
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    await this.cacheService.clearAllCache()
  }

  private validateFile(file: File): void {
    // 使用新的验证服务进行基础验证
    try {
      this.validationService.validateFile(file)
    } catch (error) {
      throw error
    }
  }

  getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) {
      return '🖼️'
    } else if (fileType === 'application/pdf') {
      return '📄'
    } else if (fileType.includes('word')) {
      return '📝'
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      return '📊'
    } else {
      return '📎'
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
