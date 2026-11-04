import React, { useEffect, useMemo } from 'react'
import {
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Select,
  Alert,
  Space,
  Row,
  Col,
  Tag,
  message,
} from 'antd'
import {
  BellOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { AppointmentRecord, CustomerRecord } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select

interface AppointmentModalProps {
  visible: boolean
  initialData?: AppointmentRecord | null
  presetCustomer?: CustomerRecord | null
  defaultDate?: string
  onClose: () => void
  onSave: (record: Partial<AppointmentRecord>) => Promise<void>
}

/**
 * 智能解析客户展示名称，杜绝展示 'undefined'
 */
export const resolveCustomerDisplayName = (
  cust?: Partial<CustomerRecord> | Partial<AppointmentRecord> | null
): string => {
  if (!cust) return ''
  const name =
    cust.customerName?.trim() ||
    (cust as any).userName?.trim() ||
    (cust as any).name?.trim()
  if (name && name !== 'undefined' && name !== 'null') {
    return name
  }
  const mobile = cust.mobile?.trim()
  if (mobile && mobile !== 'undefined') {
    return mobile.length >= 4 ? `客户(尾号${mobile.slice(-4)})` : `客户(${mobile})`
  }
  return '未命名客户'
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  visible,
  initialData,
  presetCustomer,
  defaultDate,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm()

  // 解析当前客户显示名称
  const currentDisplayName = useMemo(() => {
    if (initialData) {
      return resolveCustomerDisplayName({
        userName: initialData.userName,
        mobile: initialData.mobile,
      })
    }
    if (presetCustomer) {
      return resolveCustomerDisplayName(presetCustomer)
    }
    return ''
  }, [initialData, presetCustomer])

  const hasPresetName = useMemo(() => {
    if (!presetCustomer) return false
    const name = presetCustomer.customerName?.trim() || (presetCustomer as any).userName?.trim()
    return Boolean(name && name !== 'undefined' && name !== 'null' && name !== '未知客户')
  }, [presetCustomer])

  useEffect(() => {
    if (visible) {
      if (initialData) {
        form.setFieldsValue({
          userName: initialData.userName || currentDisplayName || '未命名客户',
          mobile: initialData.mobile || '',
          reservationDate: initialData.reservationDate
            ? dayjs(initialData.reservationDate, 'YYYY-MM-DD')
            : dayjs(),
          timeSlot: [
            initialData.startTime
              ? dayjs(initialData.startTime, 'HH:mm')
              : dayjs('09:30', 'HH:mm'),
            initialData.endTime
              ? dayjs(initialData.endTime, 'HH:mm')
              : dayjs('10:00', 'HH:mm'),
          ],
          reservationType: initialData.reservationType || 3,
          status: initialData.status ?? 0,
          remarks: initialData.remarks || '',
        })
      } else if (presetCustomer) {
        const initialName = hasPresetName
          ? (presetCustomer.customerName || (presetCustomer as any).userName || '').trim()
          : currentDisplayName || ''

        form.setFieldsValue({
          userName: initialName,
          mobile: presetCustomer.mobile || '',
          reservationDate: defaultDate ? dayjs(defaultDate, 'YYYY-MM-DD') : dayjs(),
          timeSlot: [dayjs('09:30', 'HH:mm'), dayjs('10:00', 'HH:mm')],
          reservationType: 3,
          status: 0,
          remarks: '',
        })
      } else {
        form.setFieldsValue({
          userName: '',
          mobile: '',
          reservationDate: defaultDate ? dayjs(defaultDate, 'YYYY-MM-DD') : dayjs(),
          timeSlot: [dayjs('09:30', 'HH:mm'), dayjs('10:00', 'HH:mm')],
          reservationType: 3,
          status: 0,
          remarks: '',
        })
      }
    } else {
      form.resetFields()
    }
  }, [visible, initialData, presetCustomer, defaultDate, form, currentDisplayName, hasPresetName])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const [startTimeObj, endTimeObj] = values.timeSlot || []

      const typeMap: Record<number, string> = {
        1: '体检预约',
        2: '报告解读',
        3: '随访提醒',
        4: '电话/视频问诊',
        5: '用药与生活建议',
      }

      // 安全防空保护：杜绝 undefined.trim() 异常
      const rawInputName = typeof values.userName === 'string' ? values.userName.trim() : ''
      const rawInputMobile = typeof values.mobile === 'string' ? values.mobile.trim() : ''
      const fallbackMobile = presetCustomer?.mobile?.trim() || initialData?.mobile?.trim() || ''

      const finalUserName =
        rawInputName ||
        currentDisplayName ||
        (rawInputMobile ? `客户(尾号${rawInputMobile.slice(-4)})` : '未命名客户')

      const finalMobile = rawInputMobile || fallbackMobile

      // 遵循项目约束：所有名为 id 或符合 xxxxId 形式的字段保持原始格式
      const payload: Partial<AppointmentRecord> = {
        id: initialData?.id,
        customerId:
          initialData?.customerId || presetCustomer?.customerId || presetCustomer?.id,
        userName: finalUserName,
        mobile: finalMobile,
        reservationDate: values.reservationDate.format('YYYY-MM-DD'),
        startTime: startTimeObj ? startTimeObj.format('HH:mm') : '09:30',
        endTime: endTimeObj ? endTimeObj.format('HH:mm') : '10:00',
        reservationType: values.reservationType,
        reservationTypeName: typeMap[values.reservationType] || '随访提醒',
        status: values.status ?? 0,
        remarks: values.remarks?.trim() || '',
        isLocal: true,
      }

      await onSave(payload)
      message.success('随访提醒已保存，已同步更新至“随访与预约日历”！')
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    }
  }

  // 弹窗标题：杜绝出现 'undefined'
  const modalTitle = initialData
    ? '编辑随访提醒便签'
    : presetCustomer
      ? `为客户【${currentDisplayName || '指定客户'}】设置随访提醒`
      : '新增随访提醒便签'

  return (
    <Modal
      title={
        <Space>
          <BellOutlined style={{ color: '#1890ff' }} />
          <span>{modalTitle}</span>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认保存提醒"
      cancelText="取消"
      destroyOnClose
      width={540}
    >
      {/* 预选客户卡片提示 */}
      {presetCustomer && (
        <Alert
          message={
            <Space size="middle" wrap>
              <span>
                <UserOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                客户标识：<b>{currentDisplayName || '未命名客户'}</b>
              </span>
              {presetCustomer.mobile ? (
                <span>
                  <PhoneOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                  联系电话：{presetCustomer.mobile}
                </span>
              ) : (
                <Tag color="orange">未登记电话</Tag>
              )}
            </Space>
          }
          description={
            !hasPresetName
              ? '当前客户档案暂缺真实姓名，系统已提供默认称呼，您也可直接在下方表单中补充姓名。'
              : undefined
          }
          type={hasPresetName ? 'info' : 'warning'}
          showIcon
          icon={hasPresetName ? <InfoCircleOutlined /> : <UserOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="userName"
              label="随访客户姓名"
              rules={[
                {
                  required: true,
                  message: '请输入客户姓名或随访称呼',
                },
              ]}
              extra="在日历日程中展示的识别称呼"
            >
              <Input placeholder="例如：张先生、王阿姨" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="mobile"
              label="联系电话"
              rules={[
                {
                  pattern: /^1[3-9]\d{9}$/,
                  message: '请输入合法的11位手机号码',
                },
              ]}
              extra="用于随访时拨打或匹配档案"
            >
              <Input placeholder="选填，例如：13800000000" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="reservationDate"
              label={
                <span>
                  <CalendarOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                  提醒日期 (年月日)
                </span>
              }
              rules={[{ required: true, message: '请选择提醒日期' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                placeholder="选择随访日期"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="timeSlot"
              label="提醒时间段"
              rules={[{ required: true, message: '请选择提醒时间段' }]}
            >
              <TimePicker.RangePicker
                format="HH:mm"
                minuteStep={15}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reservationType"
          label="随访事项类别"
          rules={[{ required: true, message: '请选择随访类别' }]}
        >
          <Select placeholder="请选择随访类别">
            <Option value={3}>慢病阶段性随访复查</Option>
            <Option value={2}>体检报告指标解读</Option>
            <Option value={5}>用药指导与生活方式改善</Option>
            <Option value={4}>电话 / 企微沟通咨询</Option>
            <Option value={1}>体检预约跟进</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="remarks"
          label="随访提醒内容与备注"
          rules={[{ required: true, message: '请填写随访提醒要点' }]}
        >
          <TextArea
            rows={3}
            placeholder="例如：询问近1周空腹血糖测量值、提醒复查肝肾功能、跟进高血压用药依从性等..."
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
