import { useEffect, useCallback } from 'react'
import { useConsultationStore } from '@/stores/consultationStore'
import type { Consultation, ConsultationStatus } from '@/types'

export const useConsultations = () => {
  const {
    pendingConsultations,
    activeConsultations,
    completedConsultations,
    selectedConsultation,
    loading,
    error,
    refreshing,
    fetchPendingConsultations,
    fetchConsultationDetail,
    acceptConsultation,
    completeConsultation,
    updateConsultationStatus,
    setSelectedConsultation,
    setLoading,
    setError,
    clearError,
    refreshConsultations,
    updateConsultationInStore,
  } = useConsultationStore()

  // 初始化加载
  useEffect(() => {
    fetchPendingConsultations()
  }, [fetchPendingConsultations])

  // 接受问诊
  const handleAcceptConsultation = useCallback(
    async (consultationId: string) => {
      try {
        await acceptConsultation(consultationId)
        return true
      } catch (error) {
        console.error('Accept consultation failed:', error)
        return false
      }
    },
    [acceptConsultation]
  )

  // 完成问诊
  const handleCompleteConsultation = useCallback(
    async (consultationId: string, summary?: string) => {
      try {
        await completeConsultation(consultationId, summary)
        return true
      } catch (error) {
        console.error('Complete consultation failed:', error)
        return false
      }
    },
    [completeConsultation]
  )

  // 更新问诊状态
  const handleUpdateConsultationStatus = useCallback(
    async (consultationId: string, status: ConsultationStatus) => {
      try {
        await updateConsultationStatus(consultationId, status)
        return true
      } catch (error) {
        console.error('Update consultation status failed:', error)
        return false
      }
    },
    [updateConsultationStatus]
  )

  // 获取问诊详情
  const handleFetchConsultationDetail = useCallback(
    async (consultationId: string) => {
      try {
        await fetchConsultationDetail(consultationId)
        return true
      } catch (error) {
        console.error('Fetch consultation detail failed:', error)
        return false
      }
    },
    [fetchConsultationDetail]
  )

  // 刷新问诊列表
  const handleRefreshConsultations = useCallback(async () => {
    try {
      await refreshConsultations()
      return true
    } catch (error) {
      console.error('Refresh consultations failed:', error)
      return false
    }
  }, [refreshConsultations])

  // 获取问诊统计信息
  const getConsultationStats = useCallback(() => {
    return {
      pending: pendingConsultations.length,
      active: activeConsultations.length,
      completed: completedConsultations.length,
      total:
        pendingConsultations.length +
        activeConsultations.length +
        completedConsultations.length,
    }
  }, [pendingConsultations, activeConsultations, completedConsultations])

  // 根据ID查找问诊
  const findConsultationById = useCallback(
    (consultationId: string): Consultation | undefined => {
      const allConsultations = [
        ...pendingConsultations,
        ...activeConsultations,
        ...completedConsultations,
      ]
      return allConsultations.find(c => c.id === consultationId)
    },
    [pendingConsultations, activeConsultations, completedConsultations]
  )

  // 获取高优先级问诊
  const getHighPriorityConsultations = useCallback(() => {
    return pendingConsultations.filter(
      c => c.priority === 'urgent' || c.priority === 'high'
    )
  }, [pendingConsultations])

  return {
    // 数据
    pendingConsultations,
    activeConsultations,
    completedConsultations,
    selectedConsultation,
    loading,
    error,
    refreshing,

    // 操作方法
    acceptConsultation: handleAcceptConsultation,
    completeConsultation: handleCompleteConsultation,
    updateConsultationStatus: handleUpdateConsultationStatus,
    fetchConsultationDetail: handleFetchConsultationDetail,
    refreshConsultations: handleRefreshConsultations,
    setSelectedConsultation,
    clearError,

    // 工具方法
    getConsultationStats,
    findConsultationById,
    getHighPriorityConsultations,
    updateConsultationInStore,
  }
}

export default useConsultations
