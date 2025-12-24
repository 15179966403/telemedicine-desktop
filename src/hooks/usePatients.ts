import { useCallback, useEffect } from 'react'
import { usePatientStore } from '@/stores'
import { PatientService } from '@/services'
import { useErrorHandler } from '@/utils/errorHandler'
import { debounce } from '@/utils/helpers'
import type { Patient } from '@/types'
import type { PatientQuery } from '@/services/patientService'

export function usePatients() {
  const {
    patients,
    selectedPatient,
    searchQuery,
    filters,
    loading,
    error,
    setPatients,
    selectPatient,
    updatePatient,
    addPatient,
    removePatient,
    setSearchQuery,
    setFilters,
    setLoading,
    clearError,
  } = usePatientStore()

  const { handleAsyncError } = useErrorHandler()
  const patientService = PatientService.getInstance()

  // 加载患者列表
  const loadPatients = useCallback(
    async (query?: PatientQuery) => {
      setLoading(true)
      return handleAsyncError(
        async () => {
          const result = await patientService.getPatientList(query)
          setPatients(result.patients)
          return result
        },
        { patients: [], total: 0, page: 1, limit: 20 }
      ).finally(() => {
        setLoading(false)
      })
    },
    [patientService, setPatients, setLoading, handleAsyncError]
  )

  // 搜索患者
  const searchPatients = useCallback(
    debounce(async (keyword: string) => {
      if (!keyword.trim()) {
        loadPatients()
        return
      }

      setLoading(true)
      return handleAsyncError(async () => {
        const results = await patientService.searchPatients(keyword)
        setPatients(results)
        return results
      }, []).finally(() => {
        setLoading(false)
      })
    }, 300),
    [patientService, setPatients, setLoading, loadPatients, handleAsyncError]
  )

  // 获取患者详情
  const getPatientDetail = useCallback(
    async (patientId: string) => {
      return handleAsyncError(async () => {
        const patient = await patientService.getPatientDetail(patientId)
        selectPatient(patient)
        return patient
      })
    },
    [patientService, selectPatient, handleAsyncError]
  )

  // 更新患者信息
  const updatePatientInfo = useCallback(
    async (patientId: string, updates: Partial<Patient>) => {
      return handleAsyncError(async () => {
        const updatedPatient = await patientService.updatePatient(
          patientId,
          updates
        )
        updatePatient(patientId, updates)
        return updatedPatient
      })
    },
    [patientService, updatePatient, handleAsyncError]
  )

  // 更新患者标签
  const updatePatientTags = useCallback(
    async (patientId: string, tags: string[]) => {
      return handleAsyncError(async () => {
        await patientService.updatePatientTags(patientId, tags)
        updatePatient(patientId, { tags })
      })
    },
    [patientService, updatePatient, handleAsyncError]
  )

  // 添加新患者
  const createPatient = useCallback(
    async (patientData: Omit<Patient, 'id'>) => {
      return handleAsyncError(async () => {
        const newPatient = await patientService.addPatient(patientData)
        addPatient(newPatient)
        return newPatient
      })
    },
    [patientService, addPatient, handleAsyncError]
  )

  // 删除患者
  const deletePatient = useCallback(
    async (patientId: string) => {
      return handleAsyncError(async () => {
        // TODO: 实现删除患者的 API 调用
        removePatient(patientId)
      })
    },
    [removePatient, handleAsyncError]
  )

  // 处理搜索查询变化
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query)
      searchPatients(query)
    },
    [setSearchQuery, searchPatients]
  )

  // 处理筛选条件变化
  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      setFilters(newFilters)
      // 重新加载患者列表
      loadPatients({
        search: searchQuery,
        tags: newFilters.tags || filters.tags,
        dateRange: newFilters.dateRange || filters.dateRange,
      })
    },
    [setFilters, loadPatients, searchQuery, filters]
  )

  // 获取过滤后的患者列表
  const getFilteredPatients = useCallback(() => {
    let filtered = [...patients]

    // 按搜索查询过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        patient =>
          patient.name.toLowerCase().includes(query) ||
          patient.phone.includes(query) ||
          patient.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // 按标签过滤
    if (filters.tags.length > 0) {
      filtered = filtered.filter(patient =>
        filters.tags.some(tag => patient.tags.includes(tag))
      )
    }

    // 按日期范围过滤
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange
      filtered = filtered.filter(patient => {
        const visitDate = new Date(patient.lastVisit)
        return visitDate >= startDate && visitDate <= endDate
      })
    }

    return filtered
  }, [patients, searchQuery, filters])

  // 获取所有标签
  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>()
    patients.forEach(patient => {
      patient.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [patients])

  // 初始化时加载患者列表
  useEffect(() => {
    if (patients.length === 0) {
      loadPatients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    // 状态
    patients,
    selectedPatient,
    searchQuery,
    filters,
    loading,
    error,

    // 方法
    loadPatients,
    searchPatients,
    getPatientDetail,
    updatePatientInfo,
    updatePatientTags,
    createPatient,
    deletePatient,
    selectPatient,
    handleSearchChange,
    handleFiltersChange,
    clearError,

    // 计算属性
    filteredPatients: getFilteredPatients(),
    allTags: getAllTags(),
  }
}
