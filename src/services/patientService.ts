import type { Patient } from '@/types'
import { PatientCacheService } from './patientCacheService'

export interface PatientQuery {
  page?: number
  limit?: number
  search?: string
  tags?: string[]
  dateRange?: [Date, Date]
}

export interface PatientList {
  patients: Patient[]
  total: number
  page: number
  limit: number
}

export class PatientService {
  private static instance: PatientService
  private cacheService: PatientCacheService

  constructor() {
    this.cacheService = PatientCacheService.getInstance()
  }

  static getInstance(): PatientService {
    if (!PatientService.instance) {
      PatientService.instance = new PatientService()
    }
    return PatientService.instance
  }

  async getPatientList(query: PatientQuery = {}): Promise<PatientList> {
    try {
      console.log('PatientService.getPatientList called with:', query)

      // 尝试从缓存获取数据
      const cached = await this.cacheService.getCachedPatientList(query)
      if (cached) {
        console.log('Returning cached patient list')
        return cached
      }

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 800))

      // 模拟患者数据
      const mockPatients: Patient[] = [
        {
          id: '1',
          name: '李小明',
          age: 35,
          gender: 'male',
          phone: '138****1234',
          tags: ['高血压', '糖尿病'],
          lastVisit: new Date('2024-01-15'),
          medicalHistory: [],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        },
        {
          id: '2',
          name: '王小红',
          age: 28,
          gender: 'female',
          phone: '139****5678',
          tags: ['孕期检查'],
          lastVisit: new Date('2024-01-20'),
          medicalHistory: [],
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-20'),
        },
        {
          id: '3',
          name: '张大伟',
          age: 45,
          gender: 'male',
          phone: '137****9012',
          tags: ['心脏病', '高血压'],
          lastVisit: new Date('2024-01-18'),
          medicalHistory: [],
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-18'),
        },
        {
          id: '4',
          name: '刘美丽',
          age: 32,
          gender: 'female',
          phone: '136****3456',
          tags: ['过敏', '哮喘'],
          lastVisit: new Date('2024-01-22'),
          medicalHistory: [],
          createdAt: new Date('2024-01-04'),
          updatedAt: new Date('2024-01-22'),
        },
      ]

      const result = {
        patients: mockPatients,
        total: mockPatients.length,
        page: query.page || 1,
        limit: query.limit || 20,
      }

      // 缓存结果
      await this.cacheService.cachePatientList(query, result)

      return result
    } catch (error) {
      console.error('Get patient list failed:', error)
      throw new Error('获取患者列表失败')
    }
  }

  async getPatientDetail(patientId: string): Promise<Patient> {
    try {
      console.log('PatientService.getPatientDetail called with:', patientId)

      // 尝试从缓存获取数据
      const cached = await this.cacheService.getCachedPatient(patientId)
      if (cached) {
        console.log('Returning cached patient detail')
        return cached
      }

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500))

      // 模拟患者详情数据
      const mockPatient: Patient = {
        id: patientId,
        name: '李小明',
        age: 35,
        gender: 'male',
        phone: '138****1234',
        tags: ['高血压', '糖尿病'],
        lastVisit: new Date('2024-01-15'),
        medicalHistory: [
          {
            id: '1',
            patientId,
            consultationId: 'cons_1',
            diagnosis: '高血压',
            symptoms: ['头痛', '头晕'],
            prescription: [
              {
                id: 'med_1',
                medicationName: '氨氯地平片',
                dosage: '5mg',
                frequency: '每日一次',
                duration: '30天',
                instructions: '餐后服用',
              },
            ],
            examinations: [],
            doctorId: 'doc_1',
            doctorName: '张医生',
            createdAt: new Date('2024-01-10'),
          },
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
      }

      // 缓存结果
      await this.cacheService.cachePatient(mockPatient)

      return mockPatient
    } catch (error) {
      console.error('Get patient detail failed:', error)
      throw new Error('获取患者详情失败')
    }
  }

  async updatePatientTags(patientId: string, tags: string[]): Promise<void> {
    try {
      console.log('PatientService.updatePatientTags called with:', {
        patientId,
        tags,
      })

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 300))

      // 更新缓存
      await this.cacheService.updatePatientCache(patientId, { tags })

      console.log('Patient tags updated successfully')
    } catch (error) {
      console.error('Update patient tags failed:', error)
      throw new Error('更新患者标签失败')
    }
  }

  async searchPatients(keyword: string): Promise<Patient[]> {
    try {
      console.log('PatientService.searchPatients called with:', keyword)

      // 首先尝试从缓存搜索
      const cachedResults =
        await this.cacheService.searchCachedPatients(keyword)
      if (cachedResults.length > 0) {
        console.log('Returning cached search results')
        return cachedResults
      }

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 400))

      // 模拟搜索结果
      const mockResults: Patient[] = [
        {
          id: '1',
          name: '李小明',
          age: 35,
          gender: 'male',
          phone: '138****1234',
          tags: ['高血压', '糖尿病'],
          lastVisit: new Date('2024-01-15'),
          medicalHistory: [],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        },
      ]

      // 缓存搜索结果
      for (const patient of mockResults) {
        await this.cacheService.cachePatient(patient)
      }

      return mockResults
    } catch (error) {
      console.error('Search patients failed:', error)
      throw new Error('搜索患者失败')
    }
  }

  async addPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
    try {
      console.log('PatientService.addPatient called with:', patient)

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 600))

      const newPatient: Patient = {
        ...patient,
        id: `patient-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // 缓存新患者
      await this.cacheService.cachePatient(newPatient)

      return newPatient
    } catch (error) {
      console.error('Add patient failed:', error)
      throw new Error('添加患者失败')
    }
  }

  async updatePatient(
    patientId: string,
    updates: Partial<Patient>
  ): Promise<Patient> {
    try {
      console.log('PatientService.updatePatient called with:', {
        patientId,
        updates,
      })

      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 400))

      // 获取现有患者信息并更新
      const existingPatient = await this.getPatientDetail(patientId)
      const updatedPatient: Patient = {
        ...existingPatient,
        ...updates,
        updatedAt: new Date(),
      }

      // 更新缓存
      await this.cacheService.updatePatientCache(patientId, updatedPatient)

      return updatedPatient
    } catch (error) {
      console.error('Update patient failed:', error)
      throw new Error('更新患者信息失败')
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanCache(): Promise<void> {
    await this.cacheService.cleanExpiredCache()
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats() {
    return await this.cacheService.getCacheStats()
  }
}
