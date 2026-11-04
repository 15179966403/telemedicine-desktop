import React from 'react'
import {
  Calendar,
  Badge,
  Card,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Typography,
  Empty,
  Popconfirm,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { AppointmentRecord } from '@/types'

const { Text } = Typography

interface AppointmentCalendarProps {
  appointments: AppointmentRecord[]
  selectedDate: string
  loading: boolean
  onSelectDate: (date: string) => void
  onAddAppointment: (date?: string) => void
  onEditAppointment: (record: AppointmentRecord) => void
  onDeleteAppointment: (id: string | number) => void
  onStatusChange: (record: AppointmentRecord, newStatus: number) => void
  onRefresh: () => void
  onViewCustomerDetail?: (mobile: string, userName: string) => void
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  selectedDate,
  loading,
  onSelectDate,
  onAddAppointment,
  onEditAppointment,
  onDeleteAppointment,
  onStatusChange,
  onRefresh,
  onViewCustomerDetail,
}) => {
  const currentDayjs = dayjs(selectedDate || undefined)

  // 当日日程
  const dayAppointments = appointments.filter(
    item => item.reservationDate === selectedDate
  )

  // 获取指定日期的预约条目
  const getListData = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD')
    return appointments.filter(item => item.reservationDate === dateStr)
  }

  // 自定义单元格渲染
  const dateCellRender = (value: Dayjs) => {
    const list = getListData(value)
    if (list.length === 0) return null

    const pendingCount = list.filter(item => item.status !== 1 && item.status !== 2).length
    const completedCount = list.filter(item => item.status === 1).length

    return (
      <div style={{ marginTop: 2 }}>
        {pendingCount > 0 && (
          <div style={{ marginBottom: 2 }}>
            <Badge status="processing" text={<span style={{ fontSize: 11 }}>待随访 ({pendingCount})</span>} />
          </div>
        )}
        {completedCount > 0 && (
          <div>
            <Badge status="success" text={<span style={{ fontSize: 11 }}>已完成 ({completedCount})</span>} />
          </div>
        )}
      </div>
    )
  }

  return (
    <Row gutter={16}>
      {/* 左侧日历月视图 */}
      <Col xs={24} lg={15}>
        <Card
          bordered={false}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space>
                <CalendarOutlined style={{ color: '#1890ff' }} />
                <span>随访日程日历</span>
              </Space>
              <Button icon={<SyncOutlined spin={loading} />} size="small" onClick={onRefresh}>
                刷新同步
              </Button>
            </div>
          }
          styles={{ body: { padding: 12 } }}
        >
          <Calendar
            value={currentDayjs}
            onSelect={val => {
              onSelectDate(val.format('YYYY-MM-DD'))
            }}
            cellRender={(val, info) => {
              if (info.type === 'date') return dateCellRender(val)
              return info.originNode
            }}
          />
        </Card>
      </Col>

      {/* 右侧选中日期当天的日程清单（替代医生纸质笔记本） */}
      <Col xs={24} lg={9}>
        <Card
          bordered={false}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text strong style={{ fontSize: 15 }}>
                  {selectedDate === dayjs().format('YYYY-MM-DD') ? '今天 ' : ''}
                  {selectedDate}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  (共 {dayAppointments.length} 项)
                </Text>
              </div>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => onAddAppointment(selectedDate)}
              >
                新建便签
              </Button>
            </div>
          }
          style={{ height: '100%', minHeight: 520 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          {dayAppointments.length > 0 ? (
            <div style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
              {dayAppointments.map(appt => (
                <Card
                  key={appt.id}
                  size="small"
                  style={{
                    marginBottom: 12,
                    borderLeft:
                      appt.status === 1
                        ? '4px solid #52c41a'
                        : appt.status === 2
                          ? '4px solid #d9d9d9'
                          : '4px solid #1890ff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  }}
                  styles={{ body: { padding: 12 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                      <Text strong style={{ fontSize: 14 }}>
                        {appt.startTime || '09:00'} - {appt.endTime || '09:30'}
                      </Text>
                    </div>
                    <Space size={4}>
                      {appt.isLocal ? (
                        <Tag color="cyan">医生便签</Tag>
                      ) : (
                        <Tag color="blue">系统预约</Tag>
                      )}
                      <Tag
                        color={
                          appt.status === 1
                            ? 'success'
                            : appt.status === 2
                              ? 'default'
                              : 'warning'
                        }
                      >
                        {appt.status === 1
                          ? '已完成'
                          : appt.status === 2
                            ? '已取消'
                            : '待随访'}
                      </Tag>
                    </Space>
                  </div>

                  <Divider style={{ margin: '8px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Space>
                        <UserOutlined style={{ color: '#666' }} />
                        <Text strong>
                          {!appt.userName || appt.userName === 'undefined'
                            ? appt.mobile && appt.mobile !== 'undefined'
                              ? `客户(尾号${appt.mobile.slice(-4)})`
                              : '未命名客户'
                            : appt.userName}
                        </Text>
                        {appt.mobile && appt.mobile !== 'undefined' && (
                          <>
                            <PhoneOutlined style={{ color: '#666', marginLeft: 6 }} />
                            <Text type="secondary">{appt.mobile}</Text>
                          </>
                        )}
                      </Space>
                    </div>
                    {onViewCustomerDetail && appt.mobile && (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => onViewCustomerDetail(appt.mobile, appt.userName)}
                      >
                        档案
                      </Button>
                    )}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <Tag color="geekblue">{appt.reservationTypeName || '健康随访'}</Tag>
                  </div>

                  {appt.remarks && (
                    <div
                      style={{
                        marginTop: 8,
                        background: '#fafafa',
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#555',
                      }}
                    >
                      {appt.remarks}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                    }}
                  >
                    {appt.status !== 1 && (
                      <Button
                        size="small"
                        type="dashed"
                        icon={<CheckCircleOutlined />}
                        style={{ color: '#52c41a', borderColor: '#b7eb8f' }}
                        onClick={() => onStatusChange(appt, 1)}
                      >
                        完成
                      </Button>
                    )}
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onEditAppointment(appt)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定删除此条随访记录？"
                      onConfirm={() => onDeleteAppointment(appt.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Empty
                description="当天暂无随访预约"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => onAddAppointment(selectedDate)}
                >
                  添加第一条随访便签
                </Button>
              </Empty>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  )
}
