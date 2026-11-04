import { create } from 'zustand'
import type {
  Patient,
  CustomerRecord,
  CustomerQueryParams,
  ServiceRecord,
  ServiceRecordQueryParams,
  AppointmentRecord,
  AppointmentQueryParams,
} from '@/types'
import { PatientService } from '@/services/patientService'

export type PatientTabKey = 'customerList' | 'serviceExpiration' | 'calendar'

interface PatientFilters {
  searchQuery: string
  tags: string[]
  dateRange?: [Date, Date]
}

interface PatientState {
  // 当前激活的视图 Tab
  activeTab: PatientTabKey

  // 1. 客户档案列表状态 (对应 /admin/peCustomer/pageQueryList)
  customers: CustomerRecord[]
  customerTotal: number
  customerLoading: boolean
  customerParams: CustomerQueryParams

  // 2. 服务记录与到期提醒状态 (对应 /admin/peServiceRecord/pageList)
  serviceRecords: ServiceRecord[]
  serviceTotal: number
  serviceLoading: boolean
  serviceParams: ServiceRecordQueryParams

  // 3. 预约日程与随访日历状态
  appointments: AppointmentRecord[]
  appointmentTotal: number
  appointmentLoading: boolean
  selectedDate: string // 'YYYY-MM-DD'
  appointmentModalVisible: boolean
  editingAppointment: AppointmentRecord | null

  // 4. 客户档案详情抽屉
  selectedCustomer: CustomerRecord | null
  customerDrawerVisible: boolean

  // 5. 兼容历史状态
  patients: Patient[]
  selectedPatient: Patient | null
  searchQuery: string
  filters: PatientFilters
  loading: boolean
  error: string | null
}

interface PatientActions {
  setActiveTab: (tab: PatientTabKey) => void

  // 客户列表操作
  setCustomerParams: (params: Partial<CustomerQueryParams>) => void
  fetchCustomers: (overrideParams?: Partial<CustomerQueryParams>) => Promise<void>
  selectCustomer: (customer: CustomerRecord | null) => void
  openCustomerDrawer: (customer: CustomerRecord) => void
  closeCustomerDrawer: () => void

  // 服务记录操作
  setServiceParams: (params: Partial<ServiceRecordQueryParams>) => void
  fetchServiceRecords: (overrideParams?: Partial<ServiceRecordQueryParams>) => Promise<void>

  // 预约日历操作
  setSelectedDate: (date: string) => void
  fetchAppointments: (params?: AppointmentQueryParams) => Promise<void>
  saveAppointment: (appt: Partial<AppointmentRecord>) => Promise<void>
  deleteAppointment: (id: string | number) => Promise<void>
  openAppointmentModal: (appt?: AppointmentRecord | null) => void
  closeAppointmentModal: () => void

  // 历史兼容操作
  setPatients: (patients: Patient[]) => void
  selectPatient: (patient: Patient | null) => void
  updatePatient: (patientId: string | number, updates: Partial<Patient>) => void
  addPatient: (patient: Patient) => void
  removePatient: (patientId: string | number) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<PatientFilters>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

const getTodayString = () => new Date().toISOString().split('T')[0]

export const usePatientStore = create<PatientState & PatientActions>((set, get) => {
  const patientService = PatientService.getInstance()

  return {
    // State
    activeTab: 'customerList',

    customers: [],
    customerTotal: 0,
    customerLoading: false,
    customerParams: {
      pageNum: 1,
      pageSize: 20,
      customerName: '',
      mobile: '',
    },

    serviceRecords: [],
    serviceTotal: 0,
    serviceLoading: false,
    serviceParams: {
      pageNum: 1,
      pageSize: 20,
      userName: '',
      mobile: '',
      status: [2, 3], // 默认展示待服务和服务中
    },

    appointments: [],
    appointmentTotal: 0,
    appointmentLoading: false,
    selectedDate: getTodayString(),
    appointmentModalVisible: false,
    editingAppointment: null,

    selectedCustomer: null,
    customerDrawerVisible: false,

    patients: [],
    selectedPatient: null,
    searchQuery: '',
    filters: {
      searchQuery: '',
      tags: [],
    },
    loading: false,
    error: null,

    // Actions
    setActiveTab: (tab: PatientTabKey) => {
      set({ activeTab: tab })
    },

    setCustomerParams: (params: Partial<CustomerQueryParams>) => {
      const { customerParams } = get()
      set({ customerParams: { ...customerParams, ...params } })
    },

    fetchCustomers: async (overrideParams?: Partial<CustomerQueryParams>) => {
      const currentParams = get().customerParams
      const query = { ...currentParams, ...overrideParams }
      if (overrideParams) {
        for (const [key, value] of Object.entries(overrideParams)) {
          if (value === undefined) {
            delete (query as any)[key]
          }
        }
      }
      set({ customerLoading: true, error: null, customerParams: query })
      try {
        const res = await patientService.fetchCustomerList(query)
        set({
          customers: res.rows || [],
          customerTotal: res.total || 0,
          customerLoading: false,
        })
      } catch (err) {
        set({
          customerLoading: false,
          error: err instanceof Error ? err.message : '获取客户列表失败',
        })
      }
    },

    selectCustomer: (customer: CustomerRecord | null) => {
      set({ selectedCustomer: customer })
    },

    openCustomerDrawer: (customer: CustomerRecord) => {
      set({ selectedCustomer: customer, customerDrawerVisible: true })
    },

    closeCustomerDrawer: () => {
      set({ customerDrawerVisible: false })
    },

    setServiceParams: (params: Partial<ServiceRecordQueryParams>) => {
      const { serviceParams } = get()
      set({ serviceParams: { ...serviceParams, ...params } })
    },

    fetchServiceRecords: async (overrideParams?: Partial<ServiceRecordQueryParams>) => {
      const currentParams = get().serviceParams
      const query = { ...currentParams, ...overrideParams }
      if (overrideParams) {
        for (const [key, value] of Object.entries(overrideParams)) {
          if (value === undefined) {
            delete (query as any)[key]
          }
        }
      }
      set({ serviceLoading: true, error: null, serviceParams: query })
      try {
        const res = await patientService.fetchServiceRecordList(query)
        set({
          serviceRecords: res.rows || [],
          serviceTotal: res.total || 0,
          serviceLoading: false,
        })
      } catch (err) {
        set({
          serviceLoading: false,
          error: err instanceof Error ? err.message : '获取服务记录失败',
        })
      }
    },

    setSelectedDate: (date: string) => {
      set({ selectedDate: date })
    },

    fetchAppointments: async (params?: AppointmentQueryParams) => {
      const selectedDate = get().selectedDate
      const query = {
        pageNum: 1,
        pageSize: 100,
        reservationDate: selectedDate,
        ...params,
      }
      set({ appointmentLoading: true })
      try {
        const res = await patientService.getCombinedAppointments(query)
        set({
          appointments: res.rows || [],
          appointmentTotal: res.total || 0,
          appointmentLoading: false,
        })
      } catch (err) {
        set({
          appointmentLoading: false,
          error: err instanceof Error ? err.message : '获取预约列表失败',
        })
      }
    },

    saveAppointment: async (appt: Partial<AppointmentRecord>) => {
      try {
        await patientService.saveLocalAppointment(appt)
        await get().fetchAppointments()
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : '保存预约失败',
        })
        throw err
      }
    },

    deleteAppointment: async (id: string | number) => {
      try {
        await patientService.deleteLocalAppointment(id)
        await get().fetchAppointments()
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : '删除预约失败',
        })
        throw err
      }
    },

    openAppointmentModal: (appt?: AppointmentRecord | null) => {
      set({
        appointmentModalVisible: true,
        editingAppointment: appt || null,
      })
    },

    closeAppointmentModal: () => {
      set({
        appointmentModalVisible: false,
        editingAppointment: null,
      })
    },

    // 历史兼容操作
    setPatients: (patients: Patient[]) => {
      set({ patients })
    },

    selectPatient: (patient: Patient | null) => {
      set({ selectedPatient: patient })
    },

    updatePatient: (patientId: string | number, updates: Partial<Patient>) => {
      const { patients } = get()
      const updatedPatients = patients.map(p =>
        p.id === patientId ? { ...p, ...updates } : p
      )
      set({ patients: updatedPatients })

      const { selectedPatient } = get()
      if (selectedPatient?.id === patientId) {
        set({ selectedPatient: { ...selectedPatient, ...updates } })
      }
    },

    addPatient: (patient: Patient) => {
      const { patients } = get()
      set({ patients: [...patients, patient] })
    },

    removePatient: (patientId: string | number) => {
      const { patients, selectedPatient } = get()
      const updatedPatients = patients.filter(p => p.id !== patientId)
      set({ patients: updatedPatients })

      if (selectedPatient?.id === patientId) {
        set({ selectedPatient: null })
      }
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query })
    },

    setFilters: (newFilters: Partial<PatientFilters>) => {
      const { filters } = get()
      set({ filters: { ...filters, ...newFilters } })
    },

    setLoading: (loading: boolean) => {
      set({ loading })
    },

    setError: (error: string | null) => {
      set({ error })
    },

    clearError: () => {
      set({ error: null })
    },
  }
})
