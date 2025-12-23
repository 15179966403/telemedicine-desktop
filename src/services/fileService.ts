export interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  url: string
  localPath?: string
  uploadedAt: Date
}

export class FileService {
  private static instance: FileService

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService()
    }
    return FileService.instance
  }

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<FileInfo> {
    try {
      console.log('FileService.uploadFile called with:', file.name)

      // 验证文件类型和大小
      this.validateFile(file)

      // 模拟上传进度
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100))
          onProgress(i)
        }
      }

      // 模拟文件上传完成
      const fileInfo: FileInfo = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `https://cdn.telemedicine.com/files/${file.name}`,
        uploadedAt: new Date(),
      }

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

      // 模拟文件下载
      await new Promise(resolve => setTimeout(resolve, 800))

      // TODO: 实现实际的文件下载逻辑，调用 Tauri API
      const localPath = `/temp/downloads/${fileName}`

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

      // 模拟删除操作
      await new Promise(resolve => setTimeout(resolve, 300))

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

      // 模拟清理过期文件
      await new Promise(resolve => setTimeout(resolve, 1000))

      // TODO: 实现实际的文件清理逻辑
    } catch (error) {
      console.error('Cleanup expired files failed:', error)
      // 清理失败不应该影响主要功能
    }
  }

  private validateFile(file: File): void {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (file.size > maxSize) {
      throw new Error('文件大小不能超过 50MB')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('不支持的文件类型')
    }

    // 检查文件名
    if (file.name.length > 255) {
      throw new Error('文件名过长')
    }

    // 检查文件名中的特殊字符
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(file.name)) {
      throw new Error('文件名包含非法字符')
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
