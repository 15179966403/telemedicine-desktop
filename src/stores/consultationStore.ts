import { create } from 'zustand'
import { consultationService } from '@/services/consultationService'
import type { Consultation, ConsultationStatus } from '@/types'

interface ConsultationState {
  pendingConsultations: Consultation[]
  activeConsultations: Consultation[]
  completedConsultations: Consultation[]
  selectedConsultation: Consultation | null
  loading: boolean
  error: string | null
  refreshing: boolean
}

interface ConsultationActions {
  // 数据获取
  fetchPendingConsultations: () => Promise<void>
  fetchConsultationDetail: (consultationId: string) => Promise<void>

  // 问诊操作
  acceptConsultation: (consultationId: string) => Promise<void>
  completeConsultation: (
    consultationId: string,
    summary?: string
  ) => Promise<void>
  updateConsultationStatus: (
    consultationId: string,
    status: ConsultationStatus
  ) => Promise<void>

  // 状态管理
  setSelectedConsultation: (consultation: Consultation | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  // 实时更新
  refreshConsultations: () => Promise<void>
  updateConsultationInStore: (consultation: Consultation) => void
}

export const useConsultationStore = create<
  ConsultationState & ConsultationActions
>((set, get) => ({
  // State
  pendingConsultations: [],
  activeConsultations: [],
  completedConsultations: [],
  selectedConsultation: null,
  loading: false,
  error: null,
  refreshing: false,

  // Actions
  fetchPendingConsultations: async () => {
    try {
      set({ loading: true, error: null })

      const consultations = await consultationService.getPendingConsultations()

      // 按状态分类
      const pending = consultations.filter(c => c.status === 'pending')
      const active = consultations.filter(c => c.status === 'active')
      const completed = consultations.filter(c => c.status === 'completed')

      set({
        pendingConsultations: pending,
        activeConsultations: active,
        completedConsultations: completed,
        loading: false,
      })
    } catch (error) {
      console.error('Failed to fetch pending consultations:', error)
      set({
        error: error instanceof Error ? error.message : '获取待接诊列表失败',
        loading: false,
      })
    }
  },

  fetchConsultationDetail: async (consultationId: string) => {
    try {
      set({ loading: true, error: null })

      const consultation =
        await consultationService.getConsultationDetail(consultationId)

      set({
        selectedConsultation: consultation,
        loading: false,
      })
    } catch (error) {
      console.error('Failed to fetch consultation detail:', error)
      set({
        error: error instanceof Error ? error.message : '获取问诊详情失败',
        loading: false,
      })
    }
  },

  acceptConsultation: async (consultationId: string) => {
    try {
      set({ loading: true, error: null })

      await consultationService.acceptConsultation(consultationId)

      // 更新本地状态
      const { pendingConsultations, activeConsultations } = get()
      const consultation = pendingConsultations.find(
        c => c.id === consultationId
      )

      if (consultation) {
        const updatedConsultation = {
          ...consultation,
          status: 'active' as ConsultationStatus,
          updatedAt: new Date(),
        }

        set({
          pendingConsultations: pendingConsultations.filter(
            c => c.id !== consultationId
          ),
          activeConsultations: [...activeConsultations, updatedConsultation],
          selectedConsultation: updatedConsultation,
        })
      }

      set({ loading: false })
    } catch (error) {
      console.error('Failed to accept consultation:', error)
      set({
        error: error instanceof Error ? error.message : '接受问诊失败',
        loading: false,
      })
      throw error
    }
  },

  completeConsultation: async (consultationId: string, summary?: string) => {
    try {
      set({ loading: true, error: null })

      await consultationService.completeConsultation(consultationId, summary)

      // 更新本地状态
      const { activeConsultations, completedConsultations } = get()
      const consultation = activeConsultations.find(
        c => c.id === consultationId
      )

      if (consultation) {
        const updatedConsultation = {
          ...consultation,
          status: 'completed' as ConsultationStatus,
          completedAt: new Date(),
          updatedAt: new Date(),
        }

        set({
          activeConsultations: activeConsultations.filter(
            c => c.id !== consultationId
          ),
          completedConsultations: [
            ...completedConsultations,
            updatedConsultation,
          ],
          selectedConsultation: updatedConsultation,
        })
      }

      set({ loading: false })
    } catch (error) {
      console.error('Failed to complete consultation:', error)
      set({
        error: error instanceof Error ? error.message : '完成问诊失败',
        loading: false,
      })
      throw error
    }
  },

  updateConsultationStatus: async (
    consultationId: string,
    status: ConsultationStatus
  ) => {
    try {
      set({ loading: true, error: null })

      await consultationService.updateConsultationStatus(consultationId, status)

      // 更新本地状态
      get().updateConsultationInStore({
        ...get().selectedConsultation!,
        status,
        updatedAt: new Date(),
      })

      set({ loading: false })
    } catch (error) {
      console.error('Failed to update consultation status:', error)
      set({
        error: error instanceof Error ? error.message : '更新问诊状态失败',
        loading: false,
      })
      throw error
    }
  },

  setSelectedConsultation: (consultation: Consultation | null) => {
    set({ selectedConsultation: consultation })
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

  refreshConsultations: async () => {
    try {
      set({ refreshing: true })
      await get().fetchPendingConsultations()
    } catch (error) {
      console.error('Failed to refresh consultations:', error)
    } finally {
      set({ refreshing: false })
    }
  },

  updateConsultationInStore: (updatedConsultation: Consultation) => {
    const {
      pendingConsultations,
      activeConsultations,
      completedConsultations,
    } = get()

    // 根据状态更新对应的列表
    const updateList = (list: Consultation[]) =>
      list.map(c => (c.id === updatedConsultation.id ? updatedConsultation : c))

    // 移除旧状态的记录，添加到新状态
    const removeFromList = (list: Consultation[]) =>
      list.filter(c => c.id !== updatedConsultation.id)

    let newPending = removeFromList(pendingConsultations)
    let newActive = removeFromList(activeConsultations)
    let newCompleted = removeFromList(completedConsultations)

    // 根据新状态添加到对应列表
    switch (updatedConsultation.status) {
      case 'pending':
        newPending = [...newPending, updatedConsultation]
        break
      case 'active':
        newActive = [...newActive, updatedConsultation]
        break
      case 'completed':
        newCompleted = [...newCompleted, updatedConsultation]
        break
    }

    set({
      pendingConsultations: newPending,
      activeConsultations: newActive,
      completedConsultations: newCompleted,
      selectedConsultation:
        get().selectedConsultation?.id === updatedConsultation.id
          ? updatedConsultation
          : get().selectedConsultation,
    })
  },
}))
