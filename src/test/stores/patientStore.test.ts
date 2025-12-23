import { describe, it, expect, beforeEach } from 'vitest'
import { usePatientStore } from '@/stores/patientStore'
import type { Patient, PatientFilters } from '@/types'

describe('PatientStore', () => {
  const mockPatient1: Patient = {
    id: '1',
    name: '张三',
    age: 35,
    gender: 'male',
    phone: '13800138001',
    tags: ['高血压', '糖尿病'],
    lastVisit: new Date('2024-01-15'),
    medicalHistory: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  }

  const mockPatient2: Patient = {
    id: '2',
    name: '李四',
    age: 28,
    gender: 'female',
    phone: '13800138002',
    tags: ['感冒'],
    lastVisit: new Date('2024-01-20'),
    medicalHistory: [],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-20'),
  }

  beforeEach(() => {
    // Reset store state
    usePatientStore.setState({
      patients: [],
      selectedPatient: null,
      searchQuery: '',
      filters: {
        searchQuery: '',
        tags: [],
      },
      loading: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = usePatientStore.getState()

      expect(state.patients).toEqual([])
      expect(state.selectedPatient).toBeNull()
      expect(state.searchQuery).toBe('')
      expect(state.filters).toEqual({
        searchQuery: '',
        tags: [],
      })
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Patient Management', () => {
    it('should set patients', () => {
      const patients = [mockPatient1, mockPatient2]

      const { setPatients } = usePatientStore.getState()
      setPatients(patients)

      expect(usePatientStore.getState().patients).toEqual(patients)
    })

    it('should select patient', () => {
      const { selectPatient } = usePatientStore.getState()
      selectPatient(mockPatient1)

      expect(usePatientStore.getState().selectedPatient).toEqual(mockPatient1)
    })

    it('should clear selected patient', () => {
      usePatientStore.setState({ selectedPatient: mockPatient1 })

      const { selectPatient } = usePatientStore.getState()
      selectPatient(null)

      expect(usePatientStore.getState().selectedPatient).toBeNull()
    })

    it('should add patient', () => {
      usePatientStore.setState({ patients: [mockPatient1] })

      const { addPatient } = usePatientStore.getState()
      addPatient(mockPatient2)

      const state = usePatientStore.getState()
      expect(state.patients).toHaveLength(2)
      expect(state.patients).toContain(mockPatient2)
    })

    it('should remove patient', () => {
      usePatientStore.setState({ patients: [mockPatient1, mockPatient2] })

      const { removePatient } = usePatientStore.getState()
      removePatient(mockPatient1.id)

      const state = usePatientStore.getState()
      expect(state.patients).toHaveLength(1)
      expect(state.patients[0]).toEqual(mockPatient2)
    })

    it('should clear selected patient when removing selected patient', () => {
      usePatientStore.setState({
        patients: [mockPatient1, mockPatient2],
        selectedPatient: mockPatient1,
      })

      const { removePatient } = usePatientStore.getState()
      removePatient(mockPatient1.id)

      const state = usePatientStore.getState()
      expect(state.selectedPatient).toBeNull()
    })
  })

  describe('Patient Updates', () => {
    beforeEach(() => {
      usePatientStore.setState({ patients: [mockPatient1, mockPatient2] })
    })

    it('should update patient', () => {
      const updates = { name: '张三三', age: 36 }

      const { updatePatient } = usePatientStore.getState()
      updatePatient(mockPatient1.id, updates)

      const state = usePatientStore.getState()
      const updatedPatient = state.patients.find(p => p.id === mockPatient1.id)

      expect(updatedPatient?.name).toBe('张三三')
      expect(updatedPatient?.age).toBe(36)
      expect(updatedPatient?.gender).toBe(mockPatient1.gender) // unchanged
    })

    it('should update selected patient when updating selected patient', () => {
      usePatientStore.setState({ selectedPatient: mockPatient1 })

      const updates = { name: '张三三' }

      const { updatePatient } = usePatientStore.getState()
      updatePatient(mockPatient1.id, updates)

      const state = usePatientStore.getState()
      expect(state.selectedPatient?.name).toBe('张三三')
    })

    it('should not affect other patients when updating', () => {
      const updates = { name: '张三三' }

      const { updatePatient } = usePatientStore.getState()
      updatePatient(mockPatient1.id, updates)

      const state = usePatientStore.getState()
      const otherPatient = state.patients.find(p => p.id === mockPatient2.id)

      expect(otherPatient).toEqual(mockPatient2) // unchanged
    })
  })

  describe('Search and Filters', () => {
    it('should set search query', () => {
      const query = '张三'

      const { setSearchQuery } = usePatientStore.getState()
      setSearchQuery(query)

      expect(usePatientStore.getState().searchQuery).toBe(query)
    })

    it('should set filters', () => {
      const newFilters: Partial<PatientFilters> = {
        tags: ['高血压'],
      }

      const { setFilters } = usePatientStore.getState()
      setFilters(newFilters)

      const state = usePatientStore.getState()
      expect(state.filters.tags).toEqual(['高血压'])
      expect(state.filters.searchQuery).toBe('') // unchanged
    })

    it('should merge filters with existing filters', () => {
      usePatientStore.setState({
        filters: {
          searchQuery: 'existing',
          tags: ['existing-tag'],
        },
      })

      const { setFilters } = usePatientStore.getState()
      setFilters({ tags: ['new-tag'] })

      const state = usePatientStore.getState()
      expect(state.filters.searchQuery).toBe('existing') // preserved
      expect(state.filters.tags).toEqual(['new-tag']) // updated
    })
  })

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = usePatientStore.getState()
      setLoading(true)

      expect(usePatientStore.getState().loading).toBe(true)

      setLoading(false)
      expect(usePatientStore.getState().loading).toBe(false)
    })

    it('should set error', () => {
      const errorMessage = '加载患者列表失败'

      const { setError } = usePatientStore.getState()
      setError(errorMessage)

      expect(usePatientStore.getState().error).toBe(errorMessage)
    })

    it('should clear error', () => {
      usePatientStore.setState({ error: 'Some error' })

      const { clearError } = usePatientStore.getState()
      clearError()

      expect(usePatientStore.getState().error).toBeNull()
    })
  })
})
