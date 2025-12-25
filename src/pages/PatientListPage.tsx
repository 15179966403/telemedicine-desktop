import React, { useState, useEffect } from 'react'
import {
  Layout,
  Card,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Avatar,
  Typography,
  Select,
  DatePicker,
  Drawer,
  message,
  Spin,
  Empty,
  Row,
  Col,
} from 'antd'
import {
  SearchOutlined,
  UserOutlined,
  FilterOutlined,
  EyeOutlined,
  TagsOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { usePatients } from '@/hooks'
import { PatientDetailDrawer } from '@/components/PatientDetailDrawer'
import { PatientTagManager } from '@/components/PatientTagManager'
import { BackButton } from '@/components/BackButton'
import type { Patient } from '@/types'
import type { ColumnsType } from 'antd/es/table'

const { Header, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

export const PatientListPage: React.FC = () => {
  const {
    filteredPatients,
    loading,
    error,
    searchQuery,
    filters,
    allTags,
    handleSearchChange,
    handleFiltersChange,
    getPatientDetail,
    updatePatientTags,
    clearError,
  } = usePatients()

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [tagManagerVisible, setTagManagerVisible] = useState(false)
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false)

  // 处理错误显示
  useEffect(() => {
    if (error) {
      message.error(error)
      clearError()
    }
  }, [error, clearError])

  // 查看患者详情
  const handleViewDetail = async (patient: Patient) => {
    try {
      await getPatientDetail(patient.id)
      setSelectedPatient(patient)
      setDetailDrawerVisible(true)
    } catch (err) {
      message.error('获取患者详情失败')
    }
  }

  // 管理患者标签
  const handleManageTags = (patient: Patient) => {
    setSelectedPatient(patient)
    setTagManagerVisible(true)
  }

  // 更新患者标签
  const handleUpdateTags = async (patientId: string, tags: string[]) => {
    try {
      await updatePatientTags(patientId, tags)
      message.success('标签更新成功')
      setTagManagerVisible(false)
    } catch (err) {
      message.error('标签更新失败')
    }
  }

  // 表格列定义
  const columns: ColumnsType<Patient> = [
    {
      title: '患者信息',
      key: 'patient',
      render: (_, record) => (
        <Space>
          <Avatar
            size={40}
            src={record.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1890ff' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <Text type="secondary">
              {record.age}岁 · {record.gender === 'male' ? '男' : '女'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map(tag => (
            <Tag key={tag} color="blue">
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '最近就诊',
      dataIndex: 'lastVisit',
      key: 'lastVisit',
      render: (date: Date) => (
        <Text type="secondary">
          {date ? new Date(date).toLocaleDateString() : '暂无记录'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
          <Button
            type="link"
            icon={<TagsOutlined />}
            onClick={() => handleManageTags(record)}
          >
            管理标签
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <BackButton to="/workspace" />
        <Title level={4} style={{ margin: '0 0 0 16px', color: '#1890ff' }}>
          患者管理
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col flex="auto"></Col>
            <Col>
              <Space>
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setFilterDrawerVisible(true)}
                >
                  筛选
                </Button>
                <Button type="primary" icon={<PlusOutlined />}>
                  添加患者
                </Button>
              </Space>
            </Col>
          </Row>

          <div style={{ marginTop: 16 }}>
            <Input
              placeholder="搜索患者姓名、电话或标签..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ maxWidth: 400 }}
              allowClear
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <Spin spinning={loading}>
              {filteredPatients.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={filteredPatients}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  }}
                />
              ) : (
                <Empty
                  description="暂无患者数据"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Spin>
          </div>
        </Card>

        {/* 筛选抽屉 */}
        <Drawer
          title="筛选条件"
          placement="right"
          onClose={() => setFilterDrawerVisible(false)}
          open={filterDrawerVisible}
          width={320}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>标签筛选</Text>
              <Select
                mode="multiple"
                placeholder="选择标签"
                style={{ width: '100%', marginTop: 8 }}
                value={filters.tags}
                onChange={tags => handleFiltersChange({ tags })}
              >
                {allTags.map(tag => (
                  <Option key={tag} value={tag}>
                    {tag}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong>就诊时间</Text>
              <RangePicker
                style={{ width: '100%', marginTop: 8 }}
                value={filters.dateRange}
                onChange={dateRange => handleFiltersChange({ dateRange })}
              />
            </div>

            <Button
              block
              onClick={() => {
                handleFiltersChange({ tags: [], dateRange: undefined })
                setFilterDrawerVisible(false)
              }}
            >
              清除筛选
            </Button>
          </Space>
        </Drawer>

        {/* 患者详情抽屉 */}
        {selectedPatient && (
          <PatientDetailDrawer
            patient={selectedPatient}
            visible={detailDrawerVisible}
            onClose={() => {
              setDetailDrawerVisible(false)
              setSelectedPatient(null)
            }}
          />
        )}

        {/* 标签管理抽屉 */}
        {selectedPatient && (
          <PatientTagManager
            patient={selectedPatient}
            visible={tagManagerVisible}
            allTags={allTags}
            onClose={() => {
              setTagManagerVisible(false)
              setSelectedPatient(null)
            }}
            onUpdateTags={handleUpdateTags}
          />
        )}
      </Content>
    </Layout>
  )
}

export default PatientListPage
