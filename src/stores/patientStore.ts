import { create } from 'zustand'
import type { Patient } from '@/types'

interface PatientFilters {
  searchQuery: string
  tags: string[]
  dateRange?: [Date, Date]
}

interface PatientState {
  patients: Patient[]
  selectedPatient: Patient | null
  searchQuery: string
  filters: PatientFilters
  loading: boolean
  error: string | null
}

interface PatientActions {
  setPatients: (patients: Patient[]) => void
  selectPatient: (patient: Patient | null) => void
  updatePatient: (patientId: string, updates: Partial<Patient>) => void
  addPatient: (patient: Patient) => void
  removePatient: (patientId: string) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<PatientFilters>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const usePatientStore = create<PatientState & PatientActions>((set, get) => ({
  // State
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
  setPatients: (patients: Patient[]) => {
    set({ patients })
  },

  selectPatient: (patient: Patient | null) => {
    set({ selectedPatient: patient })
  },

  updatePatient: (patientId: string, updates: Partial<Patient>) => {
    const { patients } = get()
    const updatedPatients = patients.map(patient =>
      patient.id === patientId ? { ...patient, ...updates } : patient
    )
    set({ patients: updatedPatients })

    // 如果更新的是当前选中的患者，也更新选中状态
    const { selectedPatient } = get()
    if (selectedPatient?.id === patientId) {
      set({ selectedPatient: { ...selectedPatient, ...updates } })
    }
  },

  addPatient: (patient: Patient) => {
    const { patients } = get()
    set({ patients: [...patients, patient] })
  },

  removePatient: (patientId: string) => {
    const { patients, selectedPatient } = get()
    const updatedPatients = patients.filter(patient => patient.id !== patientId)
    set({ patients: updatedPatients })

    // 如果删除的是当前选中的患者，清除选中状态
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
}))