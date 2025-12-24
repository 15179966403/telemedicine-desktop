/**
 * 离线功能服务
 * Offline functionality service
 */

import { invoke } from '@tauri-apps/api/core'
import { StorageManager, CacheManager } from '@/utils/storage'
import type {
  Patient,
  Message,
  Consultation,
  ApiResponse,
  SyncStatus,
  OperationResult,
} from '@/types'

// 离线数据项
export interface OfflineDataItem<T = any> {
  id: string
  type: 'patient' | 'message' | 'consultation' | 'file'
  data: T
  operation: 'create' | 'update' | 'delete'
  timestamp: Date
  syncStatus: SyncStatus
  retryCount: number
  lastError?: string
}

// 同步冲突
export interface SyncConflict<T = any> {
  id: string
  type: string
  localData: T
  remoteData: T
  conflictFields: string[]
  timestamp: Date
  resolved: boolean
}

// 离线配置
export interface OfflineConfig {
  maxCacheSize: number // bytes
  maxRetryAttempts: number
  syncInterval: number // milliseconds
  conflictResolutionStrategy: 'local' | 'remote' | 'manual'
  enableAutoSync: boolean
}

export class OfflineService {
  private static instance: OfflineService
  private storage: StorageManager
  private cache: CacheManager
  private offlineQueue: OfflineDataItem[] = []
  private conflicts: SyncConflict[] = []
  private config: OfflineConfig
  private syncTimer?: NodeJS.Timeout
  private isInitialized = false

  constructor() {
    this.storage = StorageManager.getInstance()
    this.cache = CacheManager.getInstance()
    this.config = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxRetryAttempts: 3,
      syncInterval: 30000, // 30 seconds
      conflictResolutionStrategy: 'manual',
      enableAutoSync: true,
    }
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService()
    }
    return OfflineService.instance
  }

  // 初始化离线服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 加载离线队列
      await this.loadOfflineQueue()

      // 加载冲突数据
      await this.loadConflicts()

      // 启动自动同步
      if (this.config.enableAutoSync) {
        this.startAutoSync()
      }

      this.isInitialized = true
      console.log('Offline service initialized')
    } catch (error) {
      console.error('Failed to initialize offline service:', error)
      throw error
    }
  }

  // 销毁服务
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }
    this.isInitialized = false
  }

  // 缓存患者数据
  async cachePatientData(patients: Patient[]): Promise<void> {
    try {
      const cacheKey = 'offline_patients'
      this.cache.setCache(cacheKey, patients, 24 * 60 * 60 * 1000) // 24小时缓存

      // 同时存储到 Tauri 本地数据库
      await invoke('cache_patients', { patients })

      console.log(`Cached ${patients.length} patients`)
    } catch (error) {
      console.error('Failed to cache patient data:', error)
      throw new Error('缓存患者数据失败')
    }
  }

  // 获取缓存的患者数据
  async getCachedPatientData(): Promise<Patient[]> {
    try {
      // 首先尝试从内存缓存获取
      const cacheKey = 'offline_patients'
      let patients = this.cache.getCache<Patient[]>(cacheKey)

      if (!patients) {
        // 从 Tauri 本地数据库获取
        const result = await invoke<Patient[]>('get_cached_patients')
        patients = result || []

        // 重新缓存到内存
        if (patients.length > 0) {
          this.cache.setCache(cacheKey, patients, 24 * 60 * 60 * 1000)
        }
      }

      return patients
    } catch (error) {
      console.error('Failed to get cached patient data:', error)
      return []
    }
  }

  // 缓存消息数据
  async cacheMessages(
    consultationId: string,
    messages: Message[]
  ): Promise<void> {
    try {
      const cacheKey = `offline_messages_${consultationId}`
      this.cache.setCache(cacheKey, messages, 12 * 60 * 60 * 1000) // 12小时缓存

      // 存储到 Tauri 本地数据库
      await invoke('cache_messages', { consultationId, messages })

      console.log(
        `Cached ${messages.length} messages for consultation ${consultationId}`
      )
    } catch (error) {
      console.error('Failed to cache messages:', error)
      throw new Error('缓存消息数据失败')
    }
  }

  // 获取缓存的消息数据
  async getCachedMessages(consultationId: string): Promise<Message[]> {
    try {
      // 首先尝试从内存缓存获取
      const cacheKey = `offline_messages_${consultationId}`
      let messages = this.cache.getCache<Message[]>(cacheKey)

      if (!messages) {
        // 从 Tauri 本地数据库获取
        const result = await invoke<Message[]>('get_cached_messages', {
          consultationId,
        })
        messages = result || []

        // 重新缓存到内存
        if (messages.length > 0) {
          this.cache.setCache(cacheKey, messages, 12 * 60 * 60 * 1000)
        }
      }

      return messages
    } catch (error) {
      console.error('Failed to get cached messages:', error)
      return []
    }
  }

  // 添加离线操作到队列
  async addToOfflineQueue<T>(
    id: string,
    type: OfflineDataItem['type'],
    data: T,
    operation: OfflineDataItem['operation']
  ): Promise<void> {
    try {
      const item: OfflineDataItem<T> = {
        id,
        type,
        data,
        operation,
        timestamp: new Date(),
        syncStatus: 'pending',
        retryCount: 0,
      }

      this.offlineQueue.push(item)
      await this.saveOfflineQueue()

      console.log(`Added item to offline queue: ${id} (${type}:${operation})`)
    } catch (error) {
      console.error('Failed to add item to offline queue:', error)
      throw new Error('添加离线操作失败')
    }
  }

  // 处理离线队列
  async processOfflineQueue(): Promise<OperationResult[]> {
    const results: OperationResult[] = []

    if (this.offlineQueue.length === 0) {
      return results
    }

    console.log(`Processing ${this.offlineQueue.length} offline items`)

    for (let i = this.offlineQueue.length - 1; i >= 0; i--) {
      const item = this.offlineQueue[i]

      try {
        item.syncStatus = 'syncing'
        const result = await this.syncItem(item)

        if (result.success) {
          item.syncStatus = 'synced'
          this.offlineQueue.splice(i, 1) // 移除已同步的项
          results.push(result)
        } else if (result.error?.type === 'DATA_ERROR') {
          // 数据冲突，添加到冲突列表
          await this.handleSyncConflict(item, result.error)
          item.syncStatus = 'conflict'
        } else {
          item.syncStatus = 'failed'
          item.retryCount++
          item.lastError = result.error?.message

          // 超过最大重试次数，移除项目
          if (item.retryCount >= this.config.maxRetryAttempts) {
            this.offlineQueue.splice(i, 1)
            console.warn(`Removed item after max retries: ${item.id}`)
          }
        }

        results.push(result)
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error)
        item.syncStatus = 'failed'
        item.retryCount++
        item.lastError =
          error instanceof Error ? error.message : 'Unknown error'

        results.push({
          success: false,
          error: {
            type: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        })
      }
    }

    // 保存更新后的队列
    await this.saveOfflineQueue()

    console.log(
      `Processed offline queue: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`
    )

    return results
  }

  // 获取离线队列状态
  getOfflineQueueStatus(): {
    totalItems: number
    pendingItems: number
    failedItems: number
    conflictItems: number
  } {
    const totalItems = this.offlineQueue.length
    const pendingItems = this.offlineQueue.filter(
      item => item.syncStatus === 'pending'
    ).length
    const failedItems = this.offlineQueue.filter(
      item => item.syncStatus === 'failed'
    ).length
    const conflictItems = this.offlineQueue.filter(
      item => item.syncStatus === 'conflict'
    ).length

    return {
      totalItems,
      pendingItems,
      failedItems,
      conflictItems,
    }
  }

  // 获取同步冲突
  getSyncConflicts(): SyncConflict[] {
    return this.conflicts.filter(conflict => !conflict.resolved)
  }

  // 解决同步冲突
  async resolveSyncConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: any
  ): Promise<OperationResult> {
    try {
      const conflict = this.conflicts.find(c => c.id === conflictId)
      if (!conflict) {
        throw new Error('冲突不存在')
      }

      let resolvedData: any
      switch (resolution) {
        case 'local':
          resolvedData = conflict.localData
          break
        case 'remote':
          resolvedData = conflict.remoteData
          break
        case 'merge':
          if (!mergedData) {
            throw new Error('合并数据不能为空')
          }
          resolvedData = mergedData
          break
        default:
          throw new Error('无效的解决方案')
      }

      // 应用解决方案
      const result = await this.applySyncResolution(conflict, resolvedData)

      if (result.success) {
        conflict.resolved = true
        await this.saveConflicts()
      }

      return result
    } catch (error) {
      console.error('Failed to resolve sync conflict:', error)
      return {
        success: false,
        error: {
          type: 'SYSTEM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      }
    }
  }

  // 清理过期缓存
  async cleanupExpiredCache(): Promise<void> {
    try {
      // 清理内存缓存
      this.cache.clearExpiredCache()

      // 清理 Tauri 本地数据库缓存
      await invoke('cleanup_expired_cache')

      console.log('Expired cache cleaned up')
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error)
    }
  }

  // 获取缓存统计信息
  async getCacheStats(): Promise<{
    memoryCache: any
    localDatabase: any
    totalSize: number
  }> {
    try {
      const memoryCacheStats = this.cache.getCacheStats()
      const localDatabaseStats = await invoke<any>('get_cache_stats')

      return {
        memoryCache: memoryCacheStats,
        localDatabase: localDatabaseStats,
        totalSize:
          memoryCacheStats.totalSize + (localDatabaseStats.totalSize || 0),
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        memoryCache: { totalItems: 0, expiredItems: 0, totalSize: 0 },
        localDatabase: { totalItems: 0, totalSize: 0 },
        totalSize: 0,
      }
    }
  }

  // 私有方法：同步单个项目
  private async syncItem(item: OfflineDataItem): Promise<OperationResult> {
    try {
      let result: ApiResponse

      switch (item.type) {
        case 'patient':
          result = await this.syncPatientItem(item)
          break
        case 'message':
          result = await this.syncMessageItem(item)
          break
        case 'consultation':
          result = await this.syncConsultationItem(item)
          break
        case 'file':
          result = await this.syncFileItem(item)
          break
        default:
          throw new Error(`Unsupported item type: ${item.type}`)
      }

      return {
        success: result.success,
        data: result.data,
        error: result.success
          ? undefined
          : {
              type: 'DATA_ERROR',
              message: result.message || 'Sync failed',
              timestamp: new Date(),
            },
      }
    } catch (error) {
      console.error(`Failed to sync item ${item.id}:`, error)
      return {
        success: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      }
    }
  }

  // 私有方法：同步患者项目
  private async syncPatientItem(
    item: OfflineDataItem<Patient>
  ): Promise<ApiResponse> {
    switch (item.operation) {
      case 'create':
        return await invoke('create_patient', { patient: item.data })
      case 'update':
        return await invoke('update_patient', {
          patientId: item.id,
          patient: item.data,
        })
      case 'delete':
        return await invoke('delete_patient', { patientId: item.id })
      default:
        throw new Error(`Unsupported operation: ${item.operation}`)
    }
  }

  // 私有方法：同步消息项目
  private async syncMessageItem(
    item: OfflineDataItem<Message>
  ): Promise<ApiResponse> {
    switch (item.operation) {
      case 'create':
        return await invoke('send_message', { message: item.data })
      case 'update':
        return await invoke('update_message', {
          messageId: item.id,
          message: item.data,
        })
      case 'delete':
        return await invoke('delete_message', { messageId: item.id })
      default:
        throw new Error(`Unsupported operation: ${item.operation}`)
    }
  }

  // 私有方法：同步问诊项目
  private async syncConsultationItem(
    item: OfflineDataItem<Consultation>
  ): Promise<ApiResponse> {
    switch (item.operation) {
      case 'create':
        return await invoke('create_consultation', { consultation: item.data })
      case 'update':
        return await invoke('update_consultation', {
          consultationId: item.id,
          consultation: item.data,
        })
      case 'delete':
        return await invoke('delete_consultation', { consultationId: item.id })
      default:
        throw new Error(`Unsupported operation: ${item.operation}`)
    }
  }

  // 私有方法：同步文件项目
  private async syncFileItem(item: OfflineDataItem): Promise<ApiResponse> {
    switch (item.operation) {
      case 'create':
        return await invoke('upload_file', { fileData: item.data })
      case 'delete':
        return await invoke('delete_file', { fileId: item.id })
      default:
        throw new Error(`Unsupported operation: ${item.operation}`)
    }
  }

  // 私有方法：处理同步冲突
  private async handleSyncConflict(
    item: OfflineDataItem,
    error: any
  ): Promise<void> {
    try {
      // 获取远程数据
      const remoteData = await this.fetchRemoteData(item.type, item.id)

      // 创建冲突记录
      const conflict: SyncConflict = {
        id: `conflict_${item.id}_${Date.now()}`,
        type: item.type,
        localData: item.data,
        remoteData,
        conflictFields: this.detectConflictFields(item.data, remoteData),
        timestamp: new Date(),
        resolved: false,
      }

      this.conflicts.push(conflict)
      await this.saveConflicts()

      console.log(`Sync conflict detected for ${item.type}:${item.id}`)
    } catch (error) {
      console.error('Failed to handle sync conflict:', error)
    }
  }

  // 私有方法：获取远程数据
  private async fetchRemoteData(type: string, id: string): Promise<any> {
    switch (type) {
      case 'patient':
        return await invoke('get_patient', { patientId: id })
      case 'message':
        return await invoke('get_message', { messageId: id })
      case 'consultation':
        return await invoke('get_consultation', { consultationId: id })
      default:
        throw new Error(`Unsupported type: ${type}`)
    }
  }

  // 私有方法：检测冲突字段
  private detectConflictFields(localData: any, remoteData: any): string[] {
    const conflictFields: string[] = []

    for (const key in localData) {
      if (localData.hasOwnProperty(key) && remoteData.hasOwnProperty(key)) {
        if (
          JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])
        ) {
          conflictFields.push(key)
        }
      }
    }

    return conflictFields
  }

  // 私有方法：应用同步解决方案
  private async applySyncResolution(
    conflict: SyncConflict,
    resolvedData: any
  ): Promise<OperationResult> {
    try {
      let result: ApiResponse

      switch (conflict.type) {
        case 'patient':
          result = await invoke('update_patient', {
            patientId: conflict.id,
            patient: resolvedData,
          })
          break
        case 'message':
          result = await invoke('update_message', {
            messageId: conflict.id,
            message: resolvedData,
          })
          break
        case 'consultation':
          result = await invoke('update_consultation', {
            consultationId: conflict.id,
            consultation: resolvedData,
          })
          break
        default:
          throw new Error(`Unsupported conflict type: ${conflict.type}`)
      }

      return {
        success: result.success,
        data: result.data,
        error: result.success
          ? undefined
          : {
              type: 'DATA_ERROR',
              message: result.message || 'Resolution failed',
              timestamp: new Date(),
            },
      }
    } catch (error) {
      console.error('Failed to apply sync resolution:', error)
      return {
        success: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      }
    }
  }

  // 私有方法：启动自动同步
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.processOfflineQueue()
      } catch (error) {
        console.error('Auto sync failed:', error)
      }
    }, this.config.syncInterval)

    console.log(
      `Auto sync started with interval: ${this.config.syncInterval}ms`
    )
  }

  // 私有方法：加载离线队列
  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueData = this.storage.getItem<OfflineDataItem[]>('offline_queue')
      if (queueData) {
        this.offlineQueue = queueData.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
      }
      console.log(`Loaded ${this.offlineQueue.length} items from offline queue`)
    } catch (error) {
      console.error('Failed to load offline queue:', error)
      this.offlineQueue = []
    }
  }

  // 私有方法：保存离线队列
  private async saveOfflineQueue(): Promise<void> {
    try {
      this.storage.setItem('offline_queue', this.offlineQueue)
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  // 私有方法：加载冲突数据
  private async loadConflicts(): Promise<void> {
    try {
      const conflictsData =
        this.storage.getItem<SyncConflict[]>('sync_conflicts')
      if (conflictsData) {
        this.conflicts = conflictsData.map(conflict => ({
          ...conflict,
          timestamp: new Date(conflict.timestamp),
        }))
      }
      console.log(`Loaded ${this.conflicts.length} sync conflicts`)
    } catch (error) {
      console.error('Failed to load sync conflicts:', error)
      this.conflicts = []
    }
  }

  // 私有方法：保存冲突数据
  private async saveConflicts(): Promise<void> {
    try {
      this.storage.setItem('sync_conflicts', this.conflicts)
    } catch (error) {
      console.error('Failed to save sync conflicts:', error)
    }
  }
}

// 导出单例实例
export const offlineService = OfflineService.getInstance()
