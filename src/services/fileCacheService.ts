import { invoke } from '@tauri-apps/api/tauri'
import {
  FileCacheInfo,
  FileCacheCleanupStrategy,
  FileStatistics,
} from '../types/file'

export class FileCacheService {
  private static instance: FileCacheService
  private cleanupTimer: NodeJS.Timeout | null = null
  private cacheStats: FileStatistics | null = null

  // 默认清理策略
  private defaultCleanupStrategy: FileCacheCleanupStrategy = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    maxSize: 1024 * 1024 * 1024, // 1GB
    maxFiles: 10000,
    cleanupOnStartup: true,
    cleanupInterval: 24 * 60 * 60 * 1000, // 24小时
  }

  static getInstance(): FileCacheService {
    if (!FileCacheService.instance) {
      FileCacheService.instance = new FileCacheService()
    }
    return FileCacheService.instance
  }

  constructor() {
    this.initializeCache()
  }

  /**
   * 初始化缓存系统
   */
  private async initializeCache(): Promise<void> {
    try {
      // 启动时清理（如果配置了）
      if (this.defaultCleanupStrategy.cleanupOnStartup) {
        setTimeout(() => {
          this.performCleanup().catch(console.error)
        }, 5000) // 延迟5秒启动清理
      }

      // 启动定期清理
      this.startPeriodicCleanup()

      // 初始化统计信息
      await this.updateCacheStatistics()
    } catch (error) {
      console.error('Initialize cache failed:', error)
    }
  }

  /**
   * 添加文件到缓存
   */
  async addToCache(cacheInfo: FileCacheInfo): Promise<void> {
    try {
      console.log('FileCacheService.addToCache called with:', cacheInfo.id)

      await invoke('add_file_to_cache', {
        cacheInfo: {
          ...cacheInfo,
          downloadedAt: cacheInfo.downloadedAt.toISOString(),
          lastAccessed: cacheInfo.lastAccessed.toISOString(),
          expiresAt: cacheInfo.expiresAt?.toISOString(),
        },
      })

      // 更新统计信息
      await this.updateCacheStatistics()
    } catch (error) {
      console.error('Add to cache failed:', error)
      throw new Error('添加文件到缓存失败')
    }
  }

  /**
   * 从缓存获取文件信息
   */
  async getFromCache(fileUrl: string): Promise<FileCacheInfo | null> {
    try {
      const cacheInfo = await invoke<any>('get_file_from_cache', {
        fileUrl,
      })

      if (!cacheInfo) return null

      // 更新最后访问时间
      await this.updateLastAccessed(fileUrl)

      return {
        ...cacheInfo,
        downloadedAt: new Date(cacheInfo.downloadedAt),
        lastAccessed: new Date(cacheInfo.lastAccessed),
        expiresAt: cacheInfo.expiresAt
          ? new Date(cacheInfo.expiresAt)
          : undefined,
      }
    } catch (error) {
      console.error('Get from cache failed:', error)
      return null
    }
  }

  /**
   * 检查文件是否在缓存中
   */
  async isInCache(fileUrl: string): Promise<boolean> {
    try {
      const exists = await invoke<boolean>('is_file_in_cache', {
        fileUrl,
      })

      return exists
    } catch (error) {
      console.error('Check cache failed:', error)
      return false
    }
  }

  /**
   * 从缓存删除文件
   */
  async removeFromCache(fileUrl: string): Promise<void> {
    try {
      console.log('FileCacheService.removeFromCache called with:', fileUrl)

      await invoke('remove_file_from_cache', {
        fileUrl,
      })

      // 更新统计信息
      await this.updateCacheStatistics()
    } catch (error) {
      console.error('Remove from cache failed:', error)
      throw new Error('从缓存删除文件失败')
    }
  }

  /**
   * 更新最后访问时间
   */
  async updateLastAccessed(fileUrl: string): Promise<void> {
    try {
      await invoke('update_cache_last_accessed', {
        fileUrl,
        lastAccessed: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Update last accessed failed:', error)
      // 不抛出错误，因为这不是关键操作
    }
  }

  /**
   * 执行缓存清理
   */
  async performCleanup(strategy?: Partial<FileCacheCleanupStrategy>): Promise<{
    deletedFiles: number
    freedSpace: number
  }> {
    try {
      console.log('FileCacheService.performCleanup called')

      const cleanupStrategy = { ...this.defaultCleanupStrategy, ...strategy }

      const result = await invoke<{
        deletedFiles: number
        freedSpace: number
      }>('cleanup_file_cache', {
        strategy: {
          ...cleanupStrategy,
          maxAge: cleanupStrategy.maxAge.toString(),
          cleanupInterval: cleanupStrategy.cleanupInterval.toString(),
        },
      })

      console.log(
        `Cache cleanup completed: ${result.deletedFiles} files deleted, ${result.freedSpace} bytes freed`
      )

      // 更新统计信息
      await this.updateCacheStatistics()

      return result
    } catch (error) {
      console.error('Cache cleanup failed:', error)
      return { deletedFiles: 0, freedSpace: 0 }
    }
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles(): Promise<number> {
    try {
      const deletedCount = await invoke<number>('cleanup_expired_cache_files')

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired cache files`)
        await this.updateCacheStatistics()
      }

      return deletedCount
    } catch (error) {
      console.error('Cleanup expired files failed:', error)
      return 0
    }
  }

  /**
   * 清理最少使用的文件（LRU）
   */
  async cleanupLRUFiles(maxFiles: number): Promise<number> {
    try {
      const deletedCount = await invoke<number>('cleanup_lru_cache_files', {
        maxFiles,
      })

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} LRU cache files`)
        await this.updateCacheStatistics()
      }

      return deletedCount
    } catch (error) {
      console.error('Cleanup LRU files failed:', error)
      return 0
    }
  }

  /**
   * 清理超过大小限制的文件
   */
  async cleanupOversizedCache(maxSize: number): Promise<number> {
    try {
      const freedBytes = await invoke<number>('cleanup_oversized_cache', {
        maxSize,
      })

      if (freedBytes > 0) {
        console.log(`Freed ${freedBytes} bytes from oversized cache`)
        await this.updateCacheStatistics()
      }

      return freedBytes
    } catch (error) {
      console.error('Cleanup oversized cache failed:', error)
      return 0
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStatistics(): Promise<FileStatistics> {
    if (this.cacheStats) {
      return this.cacheStats
    }

    await this.updateCacheStatistics()
    return (
      this.cacheStats || {
        totalFiles: 0,
        totalSize: 0,
        cacheHitRate: 0,
        uploadSuccessRate: 0,
        downloadSuccessRate: 0,
        averageUploadTime: 0,
        averageDownloadTime: 0,
      }
    )
  }

  /**
   * 更新缓存统计信息
   */
  private async updateCacheStatistics(): Promise<void> {
    try {
      const stats = await invoke<FileStatistics>('get_file_cache_statistics')
      this.cacheStats = stats
    } catch (error) {
      console.error('Update cache statistics failed:', error)
    }
  }

  /**
   * 获取缓存文件列表
   */
  async getCacheFileList(
    limit?: number,
    offset?: number
  ): Promise<FileCacheInfo[]> {
    try {
      const files = await invoke<any[]>('get_cache_file_list', {
        limit: limit || 100,
        offset: offset || 0,
      })

      return files.map(file => ({
        ...file,
        downloadedAt: new Date(file.downloadedAt),
        lastAccessed: new Date(file.lastAccessed),
        expiresAt: file.expiresAt ? new Date(file.expiresAt) : undefined,
      }))
    } catch (error) {
      console.error('Get cache file list failed:', error)
      return []
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      console.log('FileCacheService.clearAllCache called')

      await invoke('clear_all_file_cache')

      // 重置统计信息
      this.cacheStats = null
      await this.updateCacheStatistics()

      console.log('All cache cleared')
    } catch (error) {
      console.error('Clear all cache failed:', error)
      throw new Error('清空缓存失败')
    }
  }

  /**
   * 启动定期清理
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(console.error)
    }, this.defaultCleanupStrategy.cleanupInterval)
  }

  /**
   * 停止定期清理
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 获取清理策略
   */
  getCleanupStrategy(): FileCacheCleanupStrategy {
    return { ...this.defaultCleanupStrategy }
  }

  /**
   * 更新清理策略
   */
  updateCleanupStrategy(strategy: Partial<FileCacheCleanupStrategy>): void {
    this.defaultCleanupStrategy = {
      ...this.defaultCleanupStrategy,
      ...strategy,
    }

    // 重启定期清理
    this.startPeriodicCleanup()
  }

  /**
   * 预热缓存（预加载常用文件）
   */
  async warmupCache(fileUrls: string[]): Promise<void> {
    try {
      console.log(
        'FileCacheService.warmupCache called with',
        fileUrls.length,
        'files'
      )

      await invoke('warmup_file_cache', {
        fileUrls,
      })
    } catch (error) {
      console.error('Warmup cache failed:', error)
      // 不抛出错误，因为预热失败不应该影响主要功能
    }
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    this.stopPeriodicCleanup()
    this.cacheStats = null
  }
}
