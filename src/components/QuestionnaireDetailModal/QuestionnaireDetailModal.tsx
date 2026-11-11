import React, { useState, useEffect } from 'react'
import {
  Modal,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Spin,
  Empty,
  Space,
  Typography,
  message,
  Card,
} from 'antd'
import {
  FormOutlined,
  UserOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import type { QuestionnaireDetailResult } from '@/types'
import { PatientService } from '@/services/patientService'
import { DictService, type DictItem } from '@/services/dictService'

const { Text } = Typography

export interface QuestionnaireDetailModalProps {
  visible: boolean
  questionnaireId: string | number | null
  onClose: () => void
}

export const QuestionnaireDetailModal: React.FC<QuestionnaireDetailModalProps> = ({
  visible,
  questionnaireId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<QuestionnaireDetailResult | null>(null)
  const [exporting, setExporting] = useState(false)
  const [serviceTypeDict, setServiceTypeDict] = useState<DictItem[]>([])
  const [cardTypeDict, setCardTypeDict] = useState<DictItem[]>([])

  // 加载字典
  useEffect(() => {
    const dictService = DictService.getInstance()
    Promise.all([
      dictService.getDicts('bank_service_label'),
      dictService.getDicts('service_type'),
    ])
      .then(([serviceTypes, cardTypes]) => {
        setServiceTypeDict(serviceTypes || [])
        setCardTypeDict(cardTypes || [])
      })
      .catch(err => {
        console.warn('Load questionnaire dicts failed:', err)
      })
  }, [])

  // 加载问卷详情
  useEffect(() => {
    if (!visible || !questionnaireId) {
      setDetail(null)
      return
    }

    let isMounted = true
    setLoading(true)

    PatientService.getInstance()
      .fetchQuestionnaireDetail(questionnaireId)
      .then(res => {
        if (isMounted) {
          setDetail(res)
        }
      })
      .catch(err => {
        if (isMounted) {
          message.error(`加载问卷详情失败: ${err.message || err}`)
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [visible, questionnaireId])

  // 处理导出
  const handleExport = async () => {
    if (!questionnaireId) return
    try {
      setExporting(true)
      const fileName = `${detail?.userName || '客户'}_${detail?.questionnaireName || '健康生活问卷'}.xlsx`
      await PatientService.getInstance().exportQuestionnaireExcel(questionnaireId, fileName)
      message.success('问卷报告导出成功')
    } catch (error) {
      message.error(`导出失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExporting(false)
    }
  }

  // 计算 BMI
  const bmiInfo = (() => {
    if (!detail?.height || !detail?.weight) return null
    const h = Number(detail.height) / 100
    const w = Number(detail.weight)
    if (h > 0 && w > 0) {
      const bmi = (w / (h * h)).toFixed(1)
      const bmiVal = Number(bmi)
      let status = '正常'
      let color = 'success'
      if (bmiVal < 18.5) {
        status = '偏瘦'
        color = 'warning'
      } else if (bmiVal >= 24 && bmiVal < 28) {
        status = '超重'
        color = 'warning'
      } else if (bmiVal >= 28) {
        status = '肥胖'
        color = 'error'
      }
      return { bmi, status, color }
    }
    return null
  })()

  // 映射服务类型与产品线名称
  const getServiceTypeLabel = (val?: string | number) => {
    if (val === undefined || val === null) return '-'
    const matched = serviceTypeDict.find(item => String(item.dictValue) === String(val))
    return matched ? matched.dictLabel : String(val)
  }

  const getCardTypeLabel = (val?: string | number) => {
    if (val === undefined || val === null) return '-'
    const matched = cardTypeDict.find(item => String(item.dictValue) === String(val))
    return matched ? matched.dictLabel : String(val)
  }

  const isCompleted = detail?.completionStatus === 2 || detail?.completionStatus === '2'

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FormOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            {detail?.questionnaireName || '健康生活问卷答题详情'}
          </span>
          {detail && (
            <Tag color={isCompleted ? 'success' : 'warning'}>
              {isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              <span style={{ marginLeft: 4 }}>{isCompleted ? '已完成' : '未完成'}</span>
            </Tag>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={820}
      style={{ top: 40 }}
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 } }}
      footer={[
        <Button
          key="export"
          type="primary"
          icon={<FileExcelOutlined />}
          loading={exporting}
          onClick={handleExport}
        >
          导出 Excel 报告
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      <Spin spinning={loading} tip="正在加载问卷答题数据...">
        {!detail && !loading ? (
          <Empty description="未找到该问卷的详情数据" />
        ) : detail ? (
          <Tabs
            defaultActiveKey="answers"
            items={[
              {
                key: 'answers',
                label: (
                  <span>
                    <FormOutlined />
                    问卷答题情况 ({detail.answerList?.length || 0} 题)
                  </span>
                ),
                children: (
                  <div>
                    {(!detail.answerList || detail.answerList.length === 0) ? (
                      <Empty description="该问卷暂无答题记录" />
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {detail.answerList.map((item, index) => {
                          const isShortAnswer = item.questionType === 3
                          return (
                            <Card
                              key={item.id ?? item.questionnaireTitleId ?? index}
                              size="small"
                              style={{
                                borderRadius: 6,
                                borderColor: '#e8e8e8',
                                background: '#ffffff',
                              }}
                              styles={{
                                body: { padding: '12px 16px' },
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  marginBottom: 8,
                                }}
                              >
                                <Space align="start">
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 22,
                                      height: 22,
                                      lineHeight: '22px',
                                      borderRadius: '50%',
                                      background: '#1890ff',
                                      color: '#fff',
                                      textAlign: 'center',
                                      fontSize: 12,
                                      fontWeight: 'bold',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {index + 1}
                                  </span>
                                  <Text strong style={{ fontSize: 14, lineHeight: '22px' }}>
                                    {item.questionName}
                                  </Text>
                                </Space>
                                <Tag color={isShortAnswer ? 'geekblue' : 'cyan'}>
                                  {isShortAnswer ? '简答题' : '选择题'}
                                </Tag>
                              </div>

                              <div
                                style={{
                                  background: '#f9fbfd',
                                  border: '1px solid #e1ecf8',
                                  borderRadius: 4,
                                  padding: '8px 12px',
                                  marginLeft: 30,
                                }}
                              >
                                <Text
                                  style={{
                                    color: item.questionAnswer && item.questionAnswer !== '未作答' ? '#262626' : '#999',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {item.questionAnswer || '未填写回答'}
                                </Text>
                              </div>
                            </Card>
                          )
                        })}
                      </Space>
                    )}
                  </div>
                ),
              },
              {
                key: 'userInfo',
                label: (
                  <span>
                    <UserOutlined />
                    填写人基本信息
                  </span>
                ),
                children: (
                  <Card size="small" bordered={false}>
                    <Descriptions column={2} bordered size="small">
                      <Descriptions.Item label="填写人姓名">
                        {detail.userName || '未知'}
                      </Descriptions.Item>
                      <Descriptions.Item label="联系电话">
                        {detail.mobile || '未知'}
                      </Descriptions.Item>
                      <Descriptions.Item label="性别">
                        {detail.gender === 1 || detail.gender === '1'
                          ? '男'
                          : detail.gender === 2 || detail.gender === '2'
                            ? '女'
                            : '未填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="出生日期">
                        {detail.birthday || '未填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="身高">
                        {detail.height ? `${detail.height} cm` : '未填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="体重">
                        {detail.weight ? `${detail.weight} kg` : '未填写'}
                      </Descriptions.Item>
                      <Descriptions.Item label="体质指数 (BMI)" span={2}>
                        {bmiInfo ? (
                          <Space>
                            <span style={{ fontWeight: 600 }}>{bmiInfo.bmi}</span>
                            <Tag color={bmiInfo.color}>{bmiInfo.status}</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              (正常范围 18.5 ~ 23.9)
                            </Text>
                          </Space>
                        ) : (
                          '数据不足，无法计算'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="完成状态">
                        <Tag color={isCompleted ? 'success' : 'warning'}>
                          {isCompleted ? '已完成' : '未完成'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="问卷填写时间">
                        {detail.createTime || '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                ),
              },
              ...(detail.peServiceRecords
                ? [
                    {
                      key: 'serviceInfo',
                      label: (
                        <span>
                          <SolutionOutlined />
                          关联服务信息
                        </span>
                      ),
                      children: (
                        <Card size="small" bordered={false}>
                          <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="服务产品线">
                              {getServiceTypeLabel(detail.peServiceRecords.recordsType)}
                            </Descriptions.Item>
                            <Descriptions.Item label="服务类型">
                              {getCardTypeLabel(detail.peServiceRecords.codeType)}
                            </Descriptions.Item>
                            <Descriptions.Item label="服务状态">
                              {detail.peServiceRecords.status === 2 ? (
                                <Tag color="warning">待服务</Tag>
                              ) : detail.peServiceRecords.status === 3 ? (
                                <Tag color="success">服务中</Tag>
                              ) : detail.peServiceRecords.status === 4 ? (
                                <Tag color="default">服务结束</Tag>
                              ) : (
                                <Tag>{detail.peServiceRecords.status ?? '未知'}</Tag>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="激活时间">
                              {detail.peServiceRecords.activationTime || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="服务开始时间">
                              {detail.peServiceRecords.serviceStartTime || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="服务结束时间">
                              {detail.peServiceRecords.serviceEndTime || '-'}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </Spin>
    </Modal>
  )
}
