import type {
  Patient,
  PatientDetail,
  PatientQuery,
  PatientList,
  CustomerRecord,
  CustomerQueryParams,
  CustomerPageResult,
  ServiceRecordQueryParams,
  ServiceRecordPageResult,
} from '@/types'
import { StorageService } from '@/utils/storage'

/**
 * 患者数据本地缓存服务
 * Patient data local cache service
 *
 * 支持离线访问客户列表、服务记录与随访日历
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
   * 缓存客户主列表
   */
  async cacheCustomerList(
    query: CustomerQueryParams,
    data: CustomerPageResult
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_customers_${encodeURIComponent(
        JSON.stringify(query)
      )}`
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }
      await StorageService.setItem(cacheKey, cacheData)
      // 同时按 ID 缓存单个客户档案
      for (const item of data.rows) {
        if (item.id != null) {
          await this.cacheCustomerDetail(item.id, item)
        }
      }
    } catch (error) {
      console.error('Failed to cache customer list:', error)
    }
  }

  /**
   * 获取缓存的客户主列表
   */
  async getCachedCustomerList(
    query: CustomerQueryParams
  ): Promise<CustomerPageResult | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_customers_${encodeURIComponent(
        JSON.stringify(query)
      )}`
      const cached = (await StorageService.getItem(cacheKey)) as any
      if (!cached || !this.isValidCache(cached)) {
        return null
      }
      return cached.data
    } catch (error) {
      console.error('Failed to get cached customer list:', error)
      return null
    }
  }

  /**
   * 缓存服务记录列表
   */
  async cacheServiceRecordList(
    query: ServiceRecordQueryParams,
    data: ServiceRecordPageResult
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_services_${encodeURIComponent(
        JSON.stringify(query)
      )}`
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }
      await StorageService.setItem(cacheKey, cacheData)
    } catch (error) {
      console.error('Failed to cache service record list:', error)
    }
  }

  /**
   * 获取缓存的服务记录列表
   */
  async getCachedServiceRecordList(
    query: ServiceRecordQueryParams
  ): Promise<ServiceRecordPageResult | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_services_${encodeURIComponent(
        JSON.stringify(query)
      )}`
      const cached = (await StorageService.getItem(cacheKey)) as any
      if (!cached || !this.isValidCache(cached)) {
        return null
      }
      return cached.data
    } catch (error) {
      console.error('Failed to get cached service records:', error)
      return null
    }
  }

  /**
   * 缓存单个客户档案详情
   */
  async cacheCustomerDetail(
    id: string | number,
    data: CustomerRecord | any
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_cust_detail_${id}`
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }
      await StorageService.setItem(cacheKey, cacheData)
    } catch (error) {
      console.error('Failed to cache customer detail:', error)
    }
  }

  /**
   * 获取缓存的客户档案详情
   */
  async getCachedCustomerDetail(id: string | number): Promise<any | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}_cust_detail_${id}`
      const cached = (await StorageService.getItem(cacheKey)) as any
      if (!cached || !this.isValidCache(cached)) {
        return null
      }
      return cached.data
    } catch (error) {
      console.error('Failed to get cached customer detail:', error)
      return null
    }
  }

  /**
   * 缓存患者列表 (兼容既有模型)
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
    } catch (error) {
      console.error('Failed to cache patient list:', error)
    }
  }

  /**
   * 获取缓存的患者列表 (兼容既有模型)
   */
  async getCachedPatientList(query: PatientQuery): Promise<PatientList | null> {
    try {
      const cacheKey = this.generateListCacheKey(query)
      const cached = (await StorageService.getItem(cacheKey)) as any

      if (!cached || !this.isValidCache(cached)) {
        return null
      }

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
      const cacheKey = this.generatePatientCacheKey(String(patient.id))
      const cacheData = {
        data: patient,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_EXPIRY,
      }

      await StorageService.setItem(cacheKey, cacheData)

      // 更新患者索引
      await this.updatePatientIndex(String(patient.id))
    } catch (error) {
      console.error('Failed to cache patient:', error)
    }
  }

  /**
   * 获取缓存的患者数据
   */
  async getCachedPatient(patientId: string | number): Promise<Patient | null> {
    try {
      const cacheKey = this.generatePatientCacheKey(String(patientId))
      const cached = (await StorageService.getItem(cacheKey)) as any

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
      const cacheKey = this.generateDetailCacheKey(String(patientDetail.id))
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
    patientId: string | number
  ): Promise<PatientDetail | null> {
    try {
      const cacheKey = this.generateDetailCacheKey(String(patientId))
      const cached = (await StorageService.getItem(cacheKey)) as any

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
    patientId: string | number,
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
        const cached = (await StorageService.getItem(key)) as any
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

  // 私有方法

  private generateListCacheKey(query: PatientQuery): string {
    const queryStr = JSON.stringify({
      keyword: query.keyword || '',
      tags: query.tags || [],
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    })
    return `${this.CACHE_PREFIX}_list_${encodeURIComponent(queryStr)}`
  }

  private generatePatientCacheKey(patientId: string): string {
    return `${this.CACHE_PREFIX}_patient_${patientId}`
  }

  private generateDetailCacheKey(patientId: string): string {
    return `${this.CACHE_PREFIX}_detail_${patientId}`
  }

  private isValidCache(cached: any): boolean {
    return Boolean(
      cached &&
        typeof cached === 'object' &&
        cached.expiry &&
        cached.expiry > Date.now() &&
        cached.data
    )
  }

  private matchesKeyword(patient: Patient, keyword: string): boolean {
    const lowerKeyword = keyword.toLowerCase()
    return (
      patient.name.toLowerCase().includes(lowerKeyword) ||
      patient.phone.includes(keyword) ||
      (patient.tags &&
        patient.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)))
    )
  }

  private async updatePatientIndex(patientId: string): Promise<void> {
    try {
      const indexKey = `${this.CACHE_PREFIX}_index`
      const index = ((await StorageService.getItem(indexKey)) as string[]) || []

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
      return ((await StorageService.getItem(indexKey)) as string[]) || []
    } catch (error) {
      console.error('Failed to get patient index:', error)
      return []
    }
  }
}
