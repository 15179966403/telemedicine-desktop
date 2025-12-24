import type { Patient, PatientDetail, PatientQuery, PatientList } from '@/types'
import { StorageService } from '@/utils/storage'

/**
 * 患者数据本地缓存服务
 * Patient data local cache service
 */
export class PatientCacheService {
  private static instance: PatientCacheService
  private readonly CACHE_PREFIX = 'patient_cache'
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24小时
  private readonly MAX_CACHE_SIZE = 1000 // 最大缓存患者数量

  static getInstance(): PatientCacheService {
    if (!PatientCacheService.instance) {
      PatientCacheService.instance = new PatientCacheService()
    }
    return PatientCacheService.instance
  }

  /**
   * 缓存患者列表
   */
  async cachePatientList(
    query: PatientQuery,
    data: PatientList
  ): Promise<void> {
    try {
      const cacheKey = this.generateListCacheKey(query)
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }

      await StorageService.setItem(cacheKey, cacheData)

      // 同时缓存单个患者数据
      for (const patient of data.patients) {
        await this.cachePatient(patient)
      }

      console.log(`Cached patient list with key: ${cacheKey}`)
    } catch (error) {
      console.error('Failed to cache patient list:', error)
    }
  }

  /**
   * 获取缓存的患者列表
   */
  async getCachedPatientList(query: PatientQuery): Promise<PatientList | null> {
    try {
      const cacheKey = this.generateListCacheKey(query)
      const cached = await StorageService.getItem(cacheKey)

      if (!cached || !this.isValidCache(cached)) {
        return null
      }

      console.log(`Retrieved cached patient list with key: ${cacheKey}`)
      return cached.data
    } catch (error) {
      console.error('Failed to get cached patient list:', error)
      return null
    }
  }

  /**
   * 缓存单个患者数据
   */
  async cachePatient(patient: Patient): Promise<void> {
    try {
      const cacheKey = this.generatePatientCacheKey(patient.id)
      const cacheData = {
        data: patient,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }

      await StorageService.setItem(cacheKey, cacheData)

      // 更新患者索引
      await this.updatePatientIndex(patient.id)
    } catch (error) {
      console.error('Failed to cache patient:', error)
    }
  }

  /**
   * 获取缓存的患者数据
   */
  async getCachedPatient(patientId: string): Promise<Patient | null> {
    try {
      const cacheKey = this.generatePatientCacheKey(patientId)
      const cached = await StorageService.getItem(cacheKey)

      if (!cached || !this.isValidCache(cached)) {
        return null
      }

      return cached.data
    } catch (error) {
      console.error('Failed to get cached patient:', error)
      return null
    }
  }

  /**
   * 缓存患者详情
   */
  async cachePatientDetail(patientDetail: PatientDetail): Promise<void> {
    try {
      const cacheKey = this.generateDetailCacheKey(patientDetail.id)
      const cacheData = {
        data: patientDetail,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }

      await StorageService.setItem(cacheKey, cacheData)
    } catch (error) {
      console.error('Failed to cache patient detail:', error)
    }
  }

  /**
   * 获取缓存的患者详情
   */
  async getCachedPatientDetail(
    patientId: string
  ): Promise<PatientDetail | null> {
    try {
      const cacheKey = this.generateDetailCacheKey(patientId)
      const cached = await StorageService.getItem(cacheKey)

      if (!cached || !this.isValidCache(cached)) {
        return null
      }

      return cached.data
    } catch (error) {
      console.error('Failed to get cached patient detail:', error)
      return null
    }
  }

  /**
   * 更新患者缓存
   */
  async updatePatientCache(
    patientId: string,
    updates: Partial<Patient>
  ): Promise<void> {
    try {
      const cachedPatient = await this.getCachedPatient(patientId)
      if (cachedPatient) {
        const updatedPatient = { ...cachedPatient, ...updates }
        await this.cachePatient(updatedPatient)
      }

      // 同时更新详情缓存
      const cachedDetail = await this.getCachedPatientDetail(patientId)
      if (cachedDetail) {
        const updatedDetail = { ...cachedDetail, ...updates }
        await this.cachePatientDetail(updatedDetail)
      }
    } catch (error) {
      console.error('Failed to update patient cache:', error)
    }
  }

  /**
   * 搜索缓存的患者
   */
  async searchCachedPatients(keyword: string): Promise<Patient[]> {
    try {
      const patientIds = await this.getPatientIndex()
      const results: Patient[] = []

      for (const patientId of patientIds) {
        const patient = await this.getCachedPatient(patientId)
        if (patient && this.matchesKeyword(patient, keyword)) {
          results.push(patient)
        }
      }

      return results
    } catch (error) {
      console.error('Failed to search cached patients:', error)
      return []
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      const allKeys = await StorageService.getAllKeys()
      const patientCacheKeys = allKeys.filter(key =>
        key.startsWith(this.CACHE_PREFIX)
      )

      for (const key of patientCacheKeys) {
        const cached = await StorageService.getItem(key)
        if (cached && !this.isValidCache(cached)) {
          await StorageService.removeItem(key)
        }
      }

      console.log('Cleaned expired patient cache')
    } catch (error) {
      console.error('Failed to clean expired cache:', error)
    }
  }

  /**
   * 清理所有患者缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      const allKeys = await StorageService.getAllKeys()
      const patientCacheKeys = allKeys.filter(key =>
        key.startsWith(this.CACHE_PREFIX)
      )

      for (const key of patientCacheKeys) {
        await StorageService.removeItem(key)
      }

      console.log('Cleared all patient cache')
    } catch (error) {
      console.error('Failed to clear patient cache:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    totalPatients: number
    cacheSize: number
    lastCleanup: number
  }> {
    try {
      const patientIds = await this.getPatientIndex()
      const allKeys = await StorageService.getAllKeys()
      const patientCacheKeys = allKeys.filter(key =>
        key.startsWith(this.CACHE_PREFIX)
      )

      return {
        totalPatients: patientIds.length,
        cacheSize: patientCacheKeys.length,
        lastCleanup: Date.now(),
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        totalPatients: 0,
        cacheSize: 0,
        lastCleanup: 0,
      }
    }
  }

  // 私有方法

  private generateListCacheKey(query: PatientQuery): string {
    const queryStr = JSON.stringify({
      keyword: query.keyword || '',
      tags: query.tags || [],
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    })
    // Use encodeURIComponent instead of btoa to handle Unicode characters
    return `${this.CACHE_PREFIX}_list_${encodeURIComponent(queryStr)}`
  }

  private generatePatientCacheKey(patientId: string): string {
    return `${this.CACHE_PREFIX}_patient_${patientId}`
  }

  private generateDetailCacheKey(patientId: string): string {
    return `${this.CACHE_PREFIX}_detail_${patientId}`
  }

  private isValidCache(cached: unknown): boolean {
    return cached && cached.expiry && cached.expiry > Date.now() && cached.data
  }

  private matchesKeyword(patient: Patient, keyword: string): boolean {
    const lowerKeyword = keyword.toLowerCase()
    return (
      patient.name.toLowerCase().includes(lowerKeyword) ||
      patient.phone.includes(keyword) ||
      patient.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
    )
  }

  private async updatePatientIndex(patientId: string): Promise<void> {
    try {
      const indexKey = `${this.CACHE_PREFIX}_index`
      const index = (await StorageService.getItem(indexKey)) || []

      if (!index.includes(patientId)) {
        index.push(patientId)

        // 限制索引大小
        if (index.length > this.MAX_CACHE_SIZE) {
          index.splice(0, index.length - this.MAX_CACHE_SIZE)
        }

        await StorageService.setItem(indexKey, index)
      }
    } catch (error) {
      console.error('Failed to update patient index:', error)
    }
  }

  private async getPatientIndex(): Promise<string[]> {
    try {
      const indexKey = `${this.CACHE_PREFIX}_index`
      return (await StorageService.getItem(indexKey)) || []
    } catch (error) {
      console.error('Failed to get patient index:', error)
      return []
    }
  }
}
