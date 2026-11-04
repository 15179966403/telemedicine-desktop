import { useCallback } from 'react'
import { usePatientStore } from '@/stores'
import { PatientService } from '@/services'
import { useErrorHandler } from '@/utils/errorHandler'
import { debounce } from '@/utils/helpers'
import type { Patient, PatientQuery } from '@/types'

export function usePatients() {
  const store = usePatientStore()
  const { handleAsyncError } = useErrorHandler()
  const patientService = PatientService.getInstance()

  // 加载患者列表
  const loadPatients = useCallback(
    async (query?: PatientQuery) => {
      store.setLoading(true)
      return handleAsyncError(
        async () => {
          const result = await patientService.getPatientList(query)
          store.setPatients(result.patients)
          return result
        },
        { patients: [], total: 0, page: 1, pageSize: 20 }
      ).finally(() => {
        store.setLoading(false)
      })
    },
    [patientService, store, handleAsyncError]
  )

  // 搜索患者
  const searchPatients = useCallback(
    debounce(async (keyword: string) => {
      if (!keyword.trim()) {
        loadPatients()
        return
      }

      store.setLoading(true)
      return handleAsyncError(async () => {
        const results = await patientService.searchPatients(keyword)
        store.setPatients(results)
        return results
      }, []).finally(() => {
        store.setLoading(false)
      })
    }, 300),
    [patientService, store, loadPatients, handleAsyncError]
  )

  // 获取患者详情
  const getPatientDetail = useCallback(
    async (patientId: string | number) => {
      return handleAsyncError(async () => {
        const patient = await patientService.getPatientDetail(patientId)
        store.selectPatient(patient)
        return patient
      })
    },
    [patientService, store, handleAsyncError]
  )

  // 更新患者信息
  const updatePatientInfo = useCallback(
    async (patientId: string | number, updates: Partial<Patient>) => {
      return handleAsyncError(async () => {
        store.updatePatient(patientId, updates)
        return updates
      })
    },
    [store, handleAsyncError]
  )

  // 更新患者标签
  const updatePatientTags = useCallback(
    async (patientId: string | number, tags: string[]) => {
      return handleAsyncError(async () => {
        await patientService.updatePatientTags(patientId, tags)
        store.updatePatient(patientId, { tags })
      })
    },
    [patientService, store, handleAsyncError]
  )

  // 处理搜索查询变化
  const handleSearchChange = useCallback(
    (query: string) => {
      store.setSearchQuery(query)
      searchPatients(query)
    },
    [store, searchPatients]
  )

  // 处理筛选条件变化
  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof store.filters>) => {
      store.setFilters(newFilters)
      loadPatients({
        keyword: store.searchQuery,
        tags: newFilters.tags || store.filters.tags,
        page: 1,
        pageSize: 20,
      })
    },
    [store, loadPatients]
  )

  // 获取过滤后的患者列表
  const getFilteredPatients = useCallback(() => {
    let filtered = [...store.patients]

    if (store.searchQuery) {
      const query = store.searchQuery.toLowerCase()
      filtered = filtered.filter(
        patient =>
          patient.name.toLowerCase().includes(query) ||
          patient.phone.includes(query) ||
          patient.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (store.filters.tags.length > 0) {
      filtered = filtered.filter(patient =>
        store.filters.tags.some(tag => patient.tags.includes(tag))
      )
    }

    return filtered
  }, [store.patients, store.searchQuery, store.filters])

  // 获取所有标签
  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>()
    store.patients.forEach(patient => {
      patient.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [store.patients])

  return {
    // 状态
    activeTab: store.activeTab,
    setActiveTab: store.setActiveTab,

    // 客户档案列表
    customers: store.customers,
    customerTotal: store.customerTotal,
    customerLoading: store.customerLoading,
    customerParams: store.customerParams,
    setCustomerParams: store.setCustomerParams,
    fetchCustomers: store.fetchCustomers,
    selectedCustomer: store.selectedCustomer,
    selectCustomer: store.selectCustomer,
    customerDrawerVisible: store.customerDrawerVisible,
    openCustomerDrawer: store.openCustomerDrawer,
    closeCustomerDrawer: store.closeCustomerDrawer,

    // 服务到期提醒列表
    serviceRecords: store.serviceRecords,
    serviceTotal: store.serviceTotal,
    serviceLoading: store.serviceLoading,
    serviceParams: store.serviceParams,
    setServiceParams: store.setServiceParams,
    fetchServiceRecords: store.fetchServiceRecords,

    // 预约与日历
    appointments: store.appointments,
    appointmentTotal: store.appointmentTotal,
    appointmentLoading: store.appointmentLoading,
    selectedDate: store.selectedDate,
    setSelectedDate: store.setSelectedDate,
    fetchAppointments: store.fetchAppointments,
    saveAppointment: store.saveAppointment,
    deleteAppointment: store.deleteAppointment,
    appointmentModalVisible: store.appointmentModalVisible,
    editingAppointment: store.editingAppointment,
    openAppointmentModal: store.openAppointmentModal,
    closeAppointmentModal: store.closeAppointmentModal,

    // 兼容历史
    patients: store.patients,
    selectedPatient: store.selectedPatient,
    searchQuery: store.searchQuery,
    filters: store.filters,
    loading: store.loading,
    error: store.error,
    clearError: store.clearError,
    loadPatients,
    searchPatients,
    getPatientDetail,
    updatePatientInfo,
    updatePatientTags,
    selectPatient: store.selectPatient,
    handleSearchChange,
    handleFiltersChange,

    filteredPatients: getFilteredPatients(),
    allTags: getAllTags(),
  }
}
