import { invoke } from '@tauri-apps/api/core'
import {
  FileCacheInfo,
  FileStorageConfig,
  FileCacheCleanupStrategy,
  FileInfo,
} from '../types/file'

export class FileStorageService {
  private static instance: FileStorageService
  private config: FileStorageConfig

  constructor() {
    this.config = {
      localStoragePath: 'app_data/files',
      maxCacheSize: 1024 * 1024 * 1024, // 1GB
      cacheExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: true,
      encryptionEnabled: true,
    }

    // 启动定期清理
    this.startPeriodicCleanup()
  }

  static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService()
    }
    return FileStorageService.instance
  }

  /**
   * 保存文件到本地存储
   */
  async saveFileLocally(
    fileData: ArrayBuffer,
    fileName: string,
    fileInfo?: Partial<FileInfo>
  ): Promise<string> {
    try {
      console.log('FileStorageService.saveFileLocally called with:', fileName)

      // 调用 Tauri 命令保存文件
      const localPath = await invoke<string>('save_file_locally', {
        fileData: Array.from(new Uint8Array(fileData)),
        fileName,
        config: this.config,
      })

      // 更新缓存记录
      if (fileInfo) {
        await this.updateCacheRecord({
          id: fileInfo.id || `local-${Date.now()}`,
          fileUrl: fileInfo.url || '',
          localPath,
          fileSize: fileData.byteLength,
          mimeType: fileInfo.type,
          downloadedAt: new Date(),
          lastAccessed: new Date(),
        })
      }

      return localPath
    } catch (error) {
      console.error('Save file locally failed:', error)
      throw new Error('保存文件到本地失败')
    }
  }

  /**
   * 从本地存储读取文件
   */
  async readFileFromLocal(localPath: string): Promise<ArrayBuffer> {
    try {
      console.log(
        'FileStorageService.readFileFromLocal called with:',
        localPath
      )

      const fileData = await invoke<number[]>('read_file_from_local', {
        localPath,
      })

      // 更新最后访问时间
      await this.updateLastAccessed(localPath)

      return new Uint8Array(fileData).buffer
    } catch (error) {
      console.error('Read file from local failed:', error)
      throw new Error('从本地读取文件失败')
    }
  }

  /**
   * 检查文件是否存在于本地缓存
   */
  async isFileInCache(fileUrl: string): Promise<boolean> {
    try {
      const cacheInfo = await this.getCacheInfo(fileUrl)
      if (!cacheInfo) return false

      // 检查文件是否实际存在
      const exists = await invoke<boolean>('file_exists', {
        filePath: cacheInfo.localPath,
      })

      return exists
    } catch (error) {
      console.error('Check file in cache failed:', error)
      return false
    }
  }

  /**
   * 获取文件缓存信息
   */
  async getCacheInfo(fileUrl: string): Promise<FileCacheInfo | null> {
    try {
      const cacheInfo = await invoke<FileCacheInfo | null>(
        'get_file_cache_info',
        {
          fileUrl,
        }
      )

      return cacheInfo
    } catch (error) {
      console.error('Get cache info failed:', error)
      return null
    }
  }

  /**
   * 更新缓存记录
   */
  async updateCacheRecord(cacheInfo: FileCacheInfo): Promise<void> {
    try {
      await invoke('update_file_cache_record', {
        cacheInfo,
      })
    } catch (error) {
      console.error('Update cache record failed:', error)
      throw new Error('更新缓存记录失败')
    }
  }

  /**
   * 删除本地文件
   */
  async deleteLocalFile(localPath: string): Promise<void> {
    try {
      console.log('FileStorageService.deleteLocalFile called with:', localPath)

      await invoke('delete_local_file', {
        localPath,
      })

      // 删除缓存记录
      await invoke('delete_file_cache_record', {
        localPath,
      })
    } catch (error) {
      console.error('Delete local file failed:', error)
      throw new Error('删除本地文件失败')
    }
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles(
    strategy?: Partial<FileCacheCleanupStrategy>
  ): Promise<number> {
    try {
      console.log('FileStorageService.cleanupExpiredFiles called')

      const cleanupStrategy: FileCacheCleanupStrategy = {
        maxAge: this.config.cacheExpiration,
        maxSize: this.config.maxCacheSize,
        maxFiles: 10000,
        cleanupOnStartup: true,
        cleanupInterval: this.config.cleanupInterval,
        ...strategy,
      }

      const deletedCount = await invoke<number>('cleanup_expired_files', {
        strategy: cleanupStrategy,
      })

      console.log(`Cleaned up ${deletedCount} expired files`)
      return deletedCount
    } catch (error) {
      console.error('Cleanup expired files failed:', error)
      return 0
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStatistics(): Promise<{
    totalFiles: number
    totalSize: number
    oldestFile: Date | null
    newestFile: Date | null
  }> {
    try {
      const stats = await invoke<{
        totalFiles: number
        totalSize: number
        oldestFile: string | null
        newestFile: string | null
      }>('get_cache_statistics')

      return {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        oldestFile: stats.oldestFile ? new Date(stats.oldestFile) : null,
        newestFile: stats.newestFile ? new Date(stats.newestFile) : null,
      }
    } catch (error) {
      console.error('Get cache statistics failed:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      }
    }
  }

  /**
   * 压缩文件
   */
  async compressFile(filePath: string, quality: number = 80): Promise<string> {
    try {
      console.log(
        'FileStorageService.compressFile called with:',
        filePath,
        quality
      )

      const compressedPath = await invoke<string>('compress_file', {
        filePath,
        quality,
      })

      return compressedPath
    } catch (error) {
      console.error('Compress file failed:', error)
      throw new Error('文件压缩失败')
    }
  }

  /**
   * 加密文件
   */
  async encryptFile(filePath: string): Promise<string> {
    try {
      console.log('FileStorageService.encryptFile called with:', filePath)

      const encryptedPath = await invoke<string>('encrypt_file', {
        filePath,
      })

      return encryptedPath
    } catch (error) {
      console.error('Encrypt file failed:', error)
      throw new Error('文件加密失败')
    }
  }

  /**
   * 解密文件
   */
  async decryptFile(encryptedPath: string): Promise<string> {
    try {
      console.log('FileStorageService.decryptFile called with:', encryptedPath)

      const decryptedPath = await invoke<string>('decrypt_file', {
        encryptedPath,
      })

      return decryptedPath
    } catch (error) {
      console.error('Decrypt file failed:', error)
      throw new Error('文件解密失败')
    }
  }

  /**
   * 更新最后访问时间
   */
  private async updateLastAccessed(localPath: string): Promise<void> {
    try {
      await invoke('update_file_last_accessed', {
        localPath,
        lastAccessed: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Update last accessed failed:', error)
      // 不抛出错误，因为这不是关键操作
    }
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    // 启动时清理一次
    setTimeout(() => {
      this.cleanupExpiredFiles().catch(console.error)
    }, 5000)

    // 定期清理
    setInterval(() => {
      this.cleanupExpiredFiles().catch(console.error)
    }, this.config.cleanupInterval)
  }

  /**
   * 获取存储配置
   */
  getConfig(): FileStorageConfig {
    return { ...this.config }
  }

  /**
   * 更新存储配置
   */
  updateConfig(newConfig: Partial<FileStorageConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}
