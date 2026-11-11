import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Card,
  Divider,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  message,
  Table,
  Tooltip,
} from 'antd'
import {
  FormOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  FilePdfOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { HealthSchemeRecord, HealthSchemeDetail, HealthSchemeIndicator } from '@/types'
import { PatientService } from '@/services/patientService'

const { Text } = Typography
const { TextArea } = Input

export interface EditHealthSchemeModalProps {
  visible: boolean
  schemeRecord: HealthSchemeRecord | null
  onClose: () => void
  onSuccess?: () => void
}

export const EditHealthSchemeModal: React.FC<EditHealthSchemeModalProps> = ({
  visible,
  schemeRecord,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailData, setDetailData] = useState<HealthSchemeDetail | null>(null)
  const [indicators, setIndicators] = useState<HealthSchemeIndicator[]>([])
  const [doctorOptions, setDoctorOptions] = useState<Array<{ value: string | number; label: string }>>([])

  // 加载审核医师列表
  useEffect(() => {
    if (visible) {
      PatientService.getInstance()
        .fetchStaffByRole('医师')
        .then(list => {
          setDoctorOptions(list)
        })
        .catch(err => {
          console.warn('Load doctor list failed:', err)
        })
    }
  }, [visible])

  // 加载方案编辑详情
  useEffect(() => {
    if (!visible || !schemeRecord) {
      form.resetFields()
      setDetailData(null)
      setIndicators([])
      return
    }

    const schemeId = schemeRecord.id
    if (!schemeId) return

    setLoading(true)
    PatientService.getInstance()
      .fetchHealthSchemeDetail(schemeId)
      .then(detail => {
        setDetailData(detail)
        const indList = Array.isArray(detail.indicatorList) ? [...detail.indicatorList] : []
        setIndicators(indList)

        // 初始化表单
        form.setFieldsValue({
          userName: detail.userName || schemeRecord.customerName || schemeRecord.userName,
          age: detail.age,
          gender: detail.gender,
          hcyNo: detail.hcyNo,
          value: detail.value,
          cholesterol: detail.cholesterol,
          protein: detail.protein,
          // 生活习惯
          diet: detail.diet,
          motion: detail.motion,
          smoke: detail.smoke,
          drink: detail.drink,
          sleep: detail.sleep,
          socialize: detail.socialize,
          allergyHistory: detail.allergyHistory,
          medicalHistory: detail.medicalHistory,
          // 饮食宜忌
          dietSuitable: detail.dietSuitable,
          dietLimit: detail.dietLimit,
          dietTaboo: detail.dietTaboo,
          // 目标与焦点
          nutritionalGoal: detail.nutritionalGoal,
          healthFocus: detail.healthFocus,
          // 医生建议与分阶段
          checkItem: detail.checkItem,
          retestItem: detail.retestItem,
          firstStage: detail.firstStage,
          secondStage: detail.secondStage,
          thirdStage: detail.thirdStage,
          // 审核医师
          doctorId: detail.doctorId || schemeRecord.doctorId,
        })
      })
      .catch(err => {
        message.error(`获取健管方案详情失败: ${err.message || err}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [visible, schemeRecord, form])

  // 添加异常指标
  const handleAddIndicator = () => {
    if (indicators.length >= 20) {
      message.warning('最多只能添加20个异常指标')
      return
    }
    setIndicators(prev => [...prev, { indicatorName: '', indicatorValue: '' }])
  }

  // 移除异常指标
  const handleRemoveIndicator = (index: number) => {
    setIndicators(prev => prev.filter((_, idx) => idx !== index))
  }

  // 修改异常指标
  const handleIndicatorChange = (index: number, field: 'indicatorName' | 'indicatorValue', val: string) => {
    setIndicators(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: val }
      return copy
    })
  }

  // 提交修改并重新生成
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!schemeRecord?.id) {
        message.warning('缺少方案编号')
        return
      }

      // 过滤有效指标
      const validIndicators = indicators.filter(
        item => item.indicatorName?.trim() || item.indicatorValue?.trim()
      )

      // 匹配选中的医师姓名
      let doctorName = detailData?.doctorName || schemeRecord.doctorName || ''
      if (values.doctorId) {
        const matched = doctorOptions.find(d => String(d.value) === String(values.doctorId))
        if (matched) {
          doctorName = matched.label
        }
      }

      // 提取关联体检报告 ID
      let medicalReportId: string | number | undefined = undefined
      if (detailData?.peMedicalReportList && detailData.peMedicalReportList.length > 0) {
        medicalReportId = detailData.peMedicalReportList[0].id
      }

      const payload: HealthSchemeDetail = {
        ...(detailData || {}),
        ...values,
        healthSchemeRecordId: schemeRecord.id,
        indicatorList: validIndicators,
        doctorId: values.doctorId,
        doctorName,
        medicalReportId,
      }

      setSubmitting(true)
      await PatientService.getInstance().updateHealthSchemeRecord(payload)
      message.success('方案修改已提交，系统后台正在异步重新生成 PDF...')
      onSuccess?.()
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        message.error(`提交失败: ${err.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isAsyncProcessing = detailData?.async === 1 || schemeRecord?.async === 1

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <FormOutlined style={{ color: '#1890ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              修改健管方案并重新生成
            </span>
            <Tag color="blue">{schemeRecord?.customerName || schemeRecord?.userName || '客户'}</Tag>
            {schemeRecord?.mobile && <Text type="secondary" style={{ fontSize: 12 }}>({schemeRecord.mobile})</Text>}
          </Space>
          {schemeRecord?.fileUrl && (
            <Tooltip title="点击在新标签打开初版 PDF 方案比对">
              <Button
                type="link"
                size="small"
                icon={<FilePdfOutlined />}
                onClick={() => window.open(schemeRecord.doctorFileUrl || schemeRecord.fileUrl, '_blank')}
              >
                查看原版 PDF
              </Button>
            </Tooltip>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={860}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: '76vh', overflowY: 'auto', paddingRight: 12 } }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          disabled={isAsyncProcessing}
          onClick={handleSubmit}
        >
          保存修改并触发系统重生成
        </Button>,
      ]}
    >
      <Spin spinning={loading} tip="正在拉取健管方案详情...">
        {isAsyncProcessing && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="该方案目前正处于后台异步生成排队中，请等待约30秒生成完毕后再行修改。"
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical" size="small">
          {/* 1. 封面与基本信息 */}
          <Card size="small" title="1. 封面客户基本信息" style={{ marginBottom: 14 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label="客户姓名" name="userName">
                  <Input disabled placeholder="客户姓名" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="年龄" name="age">
                  <Input disabled placeholder="年龄" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="性别" name="gender">
                  <Input disabled placeholder="性别" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="健康档案编号" name="hcyNo">
                  <Input disabled placeholder="档案号" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="主要指标值/健康问题" name="value">
                  <Input placeholder="输入该方案的核心指标或问题（如 HCY: 16.5）" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="总胆固醇 (mmol/L)" name="cholesterol">
                  <Input placeholder="输入总胆固醇数值" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="低密度脂蛋白胆固醇 (mmol/L)" name="protein">
                  <Input placeholder="输入低密度脂蛋白数值" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 2. 异常指标表 */}
          <Card
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2. 异常指标列表 ({indicators.length})</span>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddIndicator}
                >
                  添加指标
                </Button>
              </div>
            }
            style={{ marginBottom: 14 }}
          >
            {indicators.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '12px 0' }}>
                暂无异常指标，如需补充请点击右上角【添加指标】
              </div>
            ) : (
              <Table
                dataSource={indicators}
                rowKey={(_, idx) => String(idx)}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '序号',
                    width: 60,
                    align: 'center',
                    render: (_, __, idx) => idx + 1,
                  },
                  {
                    title: '指标名称',
                    dataIndex: 'indicatorName',
                    render: (text, _, idx) => (
                      <Input
                        value={text}
                        placeholder="如：空腹血糖、同型半胱氨酸"
                        onChange={e => handleIndicatorChange(idx, 'indicatorName', e.target.value)}
                      />
                    ),
                  },
                  {
                    title: '指标值与异常标识',
                    dataIndex: 'indicatorValue',
                    render: (text, _, idx) => (
                      <Input
                        value={text}
                        placeholder="如：6.8 mmol/L ↑"
                        onChange={e => handleIndicatorChange(idx, 'indicatorValue', e.target.value)}
                      />
                    ),
                  },
                  {
                    title: '操作',
                    width: 70,
                    align: 'center',
                    render: (_, __, idx) => (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveIndicator(idx)}
                      />
                    ),
                  },
                ]}
              />
            )}
          </Card>

          {/* 3. 生活习惯与既往史 */}
          <Card size="small" title="3. 客户健康状况与生活习惯" style={{ marginBottom: 14 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="饮食习惯" name="diet">
                  <Input placeholder="如：高盐高油、不规律" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="运动习惯" name="motion">
                  <Input placeholder="如：极少运动、每周散步2次" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="吸烟史" name="smoke">
                  <Input placeholder="如：吸烟10年，每日半包" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="饮酒史" name="drink">
                  <Input placeholder="如：偶有应酬饮酒" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="睡眠情况" name="sleep">
                  <Input placeholder="如：入睡困难，睡眠6小时" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="社交压力" name="socialize">
                  <Input placeholder="如：工作节奏快，压力较大" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="过敏史" name="allergyHistory">
                  <Input placeholder="如：青霉素过敏、海鲜轻度过敏" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="疾病史" name="medicalHistory">
                  <Input placeholder="如：高血压病史3年，规律服药" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 4. 饮食宜忌（核心医嘱） */}
          <Card size="small" title="4. 饮食宜忌（核心膳食营养医嘱）" style={{ marginBottom: 14 }}>
            <Form.Item
              label="饮食宜 (推荐摄入食物与营养配比)"
              name="dietSuitable"
              rules={[{ required: true, message: '请输入饮食宜内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={133}
                showCount
                placeholder="多摄入深绿色十字花科蔬菜、富含B族维生素食物、深海鱼类及全谷物..."
              />
            </Form.Item>

            <Form.Item
              label="饮食限制吃 (需严格控量摄入)"
              name="dietLimit"
              rules={[{ required: true, message: '请输入饮食限制吃内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={80}
                showCount
                placeholder="限制动物内脏、油炸食品、精制糖及高盐加工肉制品摄入..."
              />
            </Form.Item>

            <Form.Item
              label="饮食禁忌 (明确禁止或严重冲突)"
              name="dietTaboo"
              rules={[{ required: true, message: '请输入饮食禁忌内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={88}
                showCount
                placeholder="忌暴饮暴食、忌空腹大量饮酒、忌霉变或生冷不洁食物..."
              />
            </Form.Item>
          </Card>

          {/* 5. 健康聚焦与干预目标 */}
          <Card size="small" title="5. 改善目标与健康焦点" style={{ marginBottom: 14 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="改善目标 (营养与代谢目标)"
                  name="nutritionalGoal"
                  rules={[{ required: true, message: '请输入改善目标' }]}
                >
                  <Input placeholder="如：3个月内同型半胱氨酸降至 10 μmol/L 以下" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="健康焦点 (当前首要干预重心)"
                  name="healthFocus"
                  rules={[{ required: true, message: '请输入健康焦点' }]}
                >
                  <Input placeholder="如：心脑血管健康管理、血管内皮保护" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 6. 医生建议与分阶段管理目标 */}
          <Card size="small" title="6. 医生专业建议与三阶段落地规划" style={{ marginBottom: 14 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="检查项目"
                  name="checkItem"
                  rules={[{ required: true, message: '请输入检查项目' }]}
                >
                  <TextArea
                    rows={3}
                    maxLength={83}
                    showCount
                    placeholder="颈动脉超声、心电图、生化全套、血常规检查..."
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="复测项目"
                  name="retestItem"
                  rules={[{ required: true, message: '请输入复测项目' }]}
                >
                  <TextArea
                    rows={3}
                    maxLength={40}
                    showCount
                    placeholder="第30天复测同型半胱氨酸、血压血糖动态监测..."
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Form.Item
              label="第一阶段 (启动期 / 1~30天)"
              name="firstStage"
              rules={[{ required: true, message: '请输入第一阶段内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={300}
                showCount
                placeholder="建立健康档案与企微专属服务群，调整膳食结构，按医嘱补充靶向营养素..."
              />
            </Form.Item>

            <Form.Item
              label="第二阶段 (巩固期 / 31~60天)"
              name="secondStage"
              rules={[{ required: true, message: '请输入第二阶段内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={300}
                showCount
                placeholder="评估阶段性生化指标与饮食依从性，强化有氧运动方案，动态调整干预节奏..."
              />
            </Form.Item>

            <Form.Item
              label="第三阶段 (维持期 / 61~90天)"
              name="thirdStage"
              rules={[{ required: true, message: '请输入第三阶段内容' }]}
            >
              <TextArea
                rows={3}
                maxLength={310}
                showCount
                placeholder="巩固良好生活方式，形成长效健康防护盾，安排终末期全套复查与健康管理综合总结..."
              />
            </Form.Item>
          </Card>

          {/* 7. 审核医师选择 */}
          <Card size="small" title="7. 审核医师配置">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="指定审核医师"
                  name="doctorId"
                  rules={[{ required: true, message: '请选择审核医师' }]}
                >
                  <Select
                    placeholder="请选择审核医师"
                    options={doctorOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Form>
      </Spin>
    </Modal>
  )
}
