import type { Patient } from '@/types'

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

  static getInstance(): PatientService {
    if (!PatientService.instance) {
      PatientService.instance = new PatientService()
    }
    return PatientService.instance
  }

  async getPatientList(query: PatientQuery = {}): Promise<PatientList> {
    try {
      console.log('PatientService.getPatientList called with:', query)

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
        },
      ]

      return {
        patients: mockPatients,
        total: mockPatients.length,
        page: query.page || 1,
        limit: query.limit || 20,
      }
    } catch (error) {
      console.error('Get patient list failed:', error)
      throw new Error('获取患者列表失败')
    }
  }

  async getPatientDetail(patientId: string): Promise<Patient> {
    try {
      console.log('PatientService.getPatientDetail called with:', patientId)

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
            doctorId: '1',
            diagnosis: '高血压',
            treatment: '降压药物治疗',
            createdAt: new Date('2024-01-10'),
          },
        ],
      }

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

      // TODO: 实现实际的标签更新逻辑
    } catch (error) {
      console.error('Update patient tags failed:', error)
      throw new Error('更新患者标签失败')
    }
  }

  async searchPatients(keyword: string): Promise<Patient[]> {
    try {
      console.log('PatientService.searchPatients called with:', keyword)

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
        },
      ]

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
      }

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
      }

      return updatedPatient
    } catch (error) {
      console.error('Update patient failed:', error)
      throw new Error('更新患者信息失败')
    }
  }
}
