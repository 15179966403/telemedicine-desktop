import React, { useState, useEffect, useMemo } from 'react'
import {
  Drawer,
  Descriptions,
  Avatar,
  Tag,
  Space,
  Button,
  Tabs,
  Card,
  Typography,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  Input,
  Table,
  Modal,
  Image,
  message,
} from 'antd'
import {
  UserOutlined,
  PhoneOutlined,
  IdcardOutlined,
  CalendarOutlined,
  TeamOutlined,
  SaveOutlined,
  BellOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
  FilePdfOutlined,
  FileSearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { CustomerRecord, Patient, MedicalReport } from '@/types'
import { PatientService } from '@/services/patientService'
import { resolveCustomerDisplayName } from '@/components/AppointmentModal/AppointmentModal'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface PatientDetailDrawerProps {
  patient?: Patient | null
  customer?: CustomerRecord | null
  visible: boolean
  onClose: () => void
  onScheduleAppointment?: (customer: CustomerRecord) => void
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patient,
  customer,
  visible,
  onClose,
  onScheduleAppointment,
}) => {
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState<CustomerRecord | null>(null)
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [selectedReportForEval, setSelectedReportForEval] = useState<MedicalReport | null>(null)
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [doctorMemo, setDoctorMemo] = useState<string>('')
  const [memoSaving, setMemoSaving] = useState(false)

  // 融合客户数据源
  const activeCustomer: CustomerRecord | null =
    customer ||
    (patient
      ? {
          id: patient.id,
          customerId: patient.customerId,
          customerName: patient.name,
          mobile: patient.phone,
          gender: patient.gender === 'male' ? 1 : 2,
          age: patient.age,
          idCardNo: patient.idCard,
          vipName: patient.vipName,
          topCompanyName: patient.companyName,
          subCompanyName: patient.subCompanyName,
          ownerPhysicianName: patient.ownerPhysicianName,
          ownerCsName: patient.ownerCsName,
          abTag: patient.tags?.join(','),
        }
      : null)

  // 当抽屉打开时加载档案详情及体检报告列表（对接后台 /admin/peCustomer/reportPageList）
  useEffect(() => {
    if (visible && activeCustomer) {
      setLoading(true)
      const patientService = PatientService.getInstance()

      // 读取本地持久化的医生备注
      const memoKey = `doctor_memo_cust_${activeCustomer.id}`
      const savedMemo = localStorage.getItem(memoKey) || ''
      setDoctorMemo(savedMemo)

      // 先拉取客户主档案，确保获取真实的“系统档案编号”(customer.id)
      patientService
        .fetchCustomerProfile({
          id: activeCustomer.id,
          customerId: activeCustomer.customerId,
          mobile: activeCustomer.mobile,
        })
        .then(async profileRes => {
          const loadedCust = profileRes.customer || activeCustomer
          setProfileData(loadedCust)

          // 核心修正：/admin/peCustomer/reportPageList 接口的请求参数 customerId
          // 必须使用“健康档案详情”板块中的“系统档案编号”（即 loadedCust.id 原始格式）
          const systemArchiveId = loadedCust.id ?? activeCustomer.id
          if (systemArchiveId != null && systemArchiveId !== '') {
            setReportsLoading(true)
            try {
              const reportList = await patientService.fetchCustomerReports(systemArchiveId)
              setReports(reportList || [])
            } catch (err) {
              console.warn('Load customer reports failed:', err)
              setReports([])
            } finally {
              setReportsLoading(false)
            }
          } else {
            setReports([])
          }
        })
        .catch(async err => {
          console.warn('Load customer profile failed, using local activeCustomer:', err)
          setProfileData(activeCustomer)
          const fallbackArchiveId = activeCustomer.id
          if (fallbackArchiveId != null && fallbackArchiveId !== '') {
            setReportsLoading(true)
            try {
              const reportList = await patientService.fetchCustomerReports(fallbackArchiveId)
              setReports(reportList || [])
            } catch {
              setReports([])
            } finally {
              setReportsLoading(false)
            }
          }
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setProfileData(null)
      setReports([])
      setDoctorMemo('')
      setSelectedReportForEval(null)
      setPreviewVisible(false)
    }
  }, [visible, activeCustomer?.id, activeCustomer?.customerId, activeCustomer?.mobile])

  // 单独刷新体检报告
  const handleRefreshReports = () => {
    const cust = profileData || activeCustomer
    if (!cust) return

    // 核心修正：使用“健康档案详情”板块中的“系统档案编号”
    const systemArchiveId = cust.id ?? activeCustomer?.id
    if (systemArchiveId == null || systemArchiveId === '') {
      message.warning('当前客户缺少系统档案编号，无法获取体检报告')
      return
    }

    setReportsLoading(true)
    PatientService.getInstance()
      .fetchCustomerReports(systemArchiveId)
      .then(res => {
        setReports(res || [])
        message.success('体检报告列表已刷新')
      })
      .catch(err => {
        console.warn('Refresh reports failed:', err)
        message.error('刷新报告列表失败')
      })
      .finally(() => {
        setReportsLoading(false)
      })
  }

  // 打开报告源文件预览弹窗
  const handleOpenPreview = (record: MedicalReport) => {
    const urls = Array.isArray(record.fileUrls) ? record.fileUrls : []
    if (urls.length === 0) {
      message.info('该报告暂无源附件文件')
      return
    }
    setPreviewFiles(urls)
    setPreviewVisible(true)
  }

  // 分离报告附件：图片与文档
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
  const pictureFiles = useMemo(() => {
    return previewFiles.filter(url => {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
      return imageExtensions.includes(ext)
    })
  }, [previewFiles])

  const documentFiles = useMemo(() => {
    return previewFiles.filter(url => {
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
      return !imageExtensions.includes(ext)
    })
  }, [previewFiles])

  // 保存医生便签
  const handleSaveMemo = () => {
    if (!activeCustomer) return
    setMemoSaving(true)
    try {
      const memoKey = `doctor_memo_cust_${activeCustomer.id}`
      localStorage.setItem(memoKey, doctorMemo)
      message.success('医生随访便签保存成功')
    } catch {
      message.error('便签保存失败')
    } finally {
      setMemoSaving(false)
    }
  }

  if (!activeCustomer && !profileData) {
    return null
  }

  const current = profileData || activeCustomer!

  const abTags = current.abTag
    ? current.abTag.split(',').filter(Boolean)
    : []
  const diTags = current.diTag
    ? current.diTag.split(',').filter(Boolean)
    : []
  const chTags = current.chTag
    ? current.chTag.split(',').filter(Boolean)
    : []

  const genderText =
    current.gender === 1 || current.gender === '1'
      ? '男'
      : current.gender === 2 || current.gender === '2'
        ? '女'
        : '未知'

  return (
    <Drawer
      title="客户完整档案与健康履历"
      placement="right"
      width={720}
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          {onScheduleAppointment && (
            <Button
              type="primary"
              icon={<BellOutlined />}
              onClick={() => {
                onScheduleAppointment(current)
              }}
            >
              快速设置提醒
            </Button>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {/* 顶部客户名片 */}
        <Card
          bordered={false}
          style={{
            background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f7ff 100%)',
            borderRadius: 8,
            marginBottom: 16,
          }}
          styles={{ body: { padding: 18 } }}
        >
          <Row gutter={16} align="middle">
            <Col>
              <Avatar
                size={64}
                icon={<UserOutlined />}
                style={{
                  backgroundColor: '#1890ff',
                  boxShadow: '0 4px 10px rgba(24, 144, 255, 0.3)',
                }}
              />
            </Col>
            <Col flex="1">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {resolveCustomerDisplayName(current)}
                </Title>
                <Tag color="blue">{genderText}</Tag>
                {current.age && <Tag color="cyan">{current.age} 岁</Tag>}
                {current.vipName && (
                  <Tag color="gold" style={{ fontWeight: 600 }}>
                    {current.vipName}
                  </Tag>
                )}
                {current.bankLabel && (
                  <Tag color="green" style={{ fontWeight: 500 }}>
                    {current.bankLabel}
                  </Tag>
                )}
              </div>
              <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                <Space size="large" wrap>
                  <span>
                    <PhoneOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {current.mobile || '无联系方式'}
                  </span>
                  <span>
                    <IdcardOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                    {current.idCardNo || '未登记身份证'}
                  </span>
                </Space>
              </div>
              {(current.topCompanyName || current.subCompanyName) && (
                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                  单位/机构：
                  {[current.topCompanyName, current.companyName, current.subCompanyName]
                    .filter(Boolean)
                    .join(' - ')}
                </div>
              )}
            </Col>
          </Row>

          <Divider style={{ margin: '14px 0 10px 0' }} />

          {/* 异常指标与慢病预警 */}
          <div>
            <Text strong style={{ fontSize: 13, marginRight: 8 }}>
              健康异常标识：
            </Text>
            {abTags.length === 0 && diTags.length === 0 && chTags.length === 0 ? (
              <Tag color="success">暂无明显异常标识</Tag>
            ) : (
              <Space wrap size={[6, 6]}>
                {abTags.map(tag => (
                  <Tag color="error" key={`ab_${tag}`}>
                    {tag}
                  </Tag>
                ))}
                {diTags.map(tag => (
                  <Tag color="magenta" key={`di_${tag}`}>
                    {tag}
                  </Tag>
                ))}
                {chTags.map(tag => (
                  <Tag color="orange" key={`ch_${tag}`}>
                    {tag}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        </Card>

        {/* 专属服务团队卡片 */}
        <Card
          size="small"
          title={
            <span>
              <TeamOutlined style={{ color: '#1890ff', marginRight: 6 }} />
              专属多学科管理团队
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="专属医师">
              <Text strong style={{ color: '#1890ff' }}>
                {current.ownerPhysicianName || '暂未分配'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="专属健管师">
              {current.ownerCsName || '暂未分配'}
            </Descriptions.Item>
            <Descriptions.Item label="健康管家/护士">
              {current.ownerNurseName || '暂未分配'}
            </Descriptions.Item>
            <Descriptions.Item label="专属营养师">
              {current.ownerDietitianName || '暂未分配'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 档案核心功能 Tabs */}
        <Tabs
          defaultActiveKey="profile"
          items={[
            {
              key: 'profile',
              label: '健康档案详情',
              children: (
                <Card size="small" bordered={false}>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="过敏史">
                      {current.allergyHistory || '无过敏记录'}
                    </Descriptions.Item>
                    <Descriptions.Item label="既往病史">
                      {current.pastHistory || '无重大既往病史'}
                    </Descriptions.Item>
                    <Descriptions.Item label="家族病史">
                      {current.familyHistory || '无家族病史记录'}
                    </Descriptions.Item>
                    <Descriptions.Item label="体检报告上传状态">
                      <Tag color={current.hasReport === 1 ? 'green' : 'default'}>
                        {current.hasReport === 1 ? '已上传报告' : '未上传'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="建档时间">
                      {current.createTime || '无建档时间'}
                    </Descriptions.Item>
                    <Descriptions.Item label="系统档案编号">
                      {String(current.id ?? current.customerId ?? '-')}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
            {
              key: 'medicalReports',
              label: (
                <span>
                  <FileTextOutlined />
                  体检报告 ({reports.length})
                </span>
              ),
              children: (
                <div style={{ padding: '4px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      显示从后台同步的历次健康体检、理化指标及 OCR 识别报告
                    </Text>
                    <Button
                      size="small"
                      icon={<ReloadOutlined spin={reportsLoading} />}
                      onClick={handleRefreshReports}
                    >
                      刷新列表
                    </Button>
                  </div>

                  <Table
                    columns={[
                      {
                        title: '报告编号',
                        dataIndex: 'reportId',
                        key: 'reportId',
                        width: 140,
                        render: (text: any, record: MedicalReport) => (
                          <div>
                            <Text strong style={{ fontSize: 13 }}>
                              {text || record.id || '-'}
                            </Text>
                            {record.anyiHealth && (
                              <Tag color="warning" style={{ marginLeft: 4, transform: 'scale(0.85)' }}>
                                安颐健康
                              </Tag>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: '报告类型',
                        dataIndex: 'reportType',
                        key: 'reportType',
                        width: 95,
                        render: (type: any) => {
                          const num = Number(type)
                          if (num === 1) return <Tag color="blue">体检报告</Tag>
                          if (num === 2) return <Tag color="cyan">理化指标</Tag>
                          if (num === 3) return <Tag color="default">无就医记录</Tag>
                          return <Tag color="blue">{type || '体检报告'}</Tag>
                        },
                      },
                      {
                        title: '体检机构 / 日期',
                        key: 'orgTime',
                        minWidth: 140,
                        render: (_: any, record: MedicalReport) => (
                          <div style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 500, color: '#333' }}>
                              {record.medicalOrg || '未标注机构'}
                            </div>
                            <div style={{ color: '#888', marginTop: 2 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {record.reportTime || record.uploadTime || '-'}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'OCR状态',
                        key: 'orcStatus',
                        width: 90,
                        render: (_: any, record: MedicalReport) => {
                          if (record.orcStatus === 1) return <Tag color="processing">识别中</Tag>
                          if (record.orcStatus === 2) return <Tag color="success">已完成</Tag>
                          if (record.orcStatus === 3) return <Tag color="error">识别失败</Tag>
                          return <Tag>未开始</Tag>
                        },
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 130,
                        fixed: 'right' as const,
                        render: (_: any, record: MedicalReport) => {
                          const fileCount = Array.isArray(record.fileUrls) ? record.fileUrls.length : 0
                          return (
                            <Space size={2}>
                              <Button
                                type="link"
                                size="small"
                                icon={<EyeOutlined />}
                                disabled={fileCount === 0}
                                onClick={() => handleOpenPreview(record)}
                              >
                                查看 ({fileCount})
                              </Button>
                              <Button
                                type="link"
                                size="small"
                                icon={<FileTextOutlined />}
                                onClick={() => setSelectedReportForEval(record)}
                              >
                                诊评
                              </Button>
                            </Space>
                          )
                        },
                      },
                    ]}
                    dataSource={reports}
                    rowKey={record => String(record.id ?? record.reportId ?? Math.random())}
                    loading={reportsLoading}
                    size="small"
                    pagination={
                      reports.length > 5
                        ? { pageSize: 5, showTotal: total => `共 ${total} 份报告` }
                        : false
                    }
                    locale={{
                      emptyText: (
                        <Empty
                          description="暂无关联体检报告或尚未上传 OCR 文件"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'memo',
              label: '医生随访便签 (本地记事)',
              children: (
                <Card size="small" title="医生工作随手记 (本地即时保存，替代纸质本)" bordered={false}>
                  <Paragraph type="secondary" style={{ fontSize: 12 }}>
                    随时记录与客户沟通的健康指标变化、个性化饮食方案或复查提醒。
                  </Paragraph>
                  <TextArea
                    rows={6}
                    placeholder="输入该客户的随访要点、用药禁忌或预约备忘..."
                    value={doctorMemo}
                    onChange={e => setDoctorMemo(e.target.value)}
                  />
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={memoSaving}
                      onClick={handleSaveMemo}
                    >
                      保存便签
                    </Button>
                  </div>
                </Card>
              ),
            },
          ]}
        />
      </Spin>

      {/* 报告源文件/附件预览弹窗 */}
      <Modal
        title={
          <Space>
            <FileSearchOutlined style={{ color: '#1890ff' }} />
            <span>报告原件与附件预览</span>
          </Space>
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
        ]}
        width={620}
      >
        {pictureFiles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              体检图片 ({pictureFiles.length} 张，点击图片可放大缩放预览)
            </Text>
            <Image.PreviewGroup>
              <Space wrap size={[10, 10]}>
                {pictureFiles.map((url, idx) => (
                  <Image
                    key={idx}
                    width={110}
                    height={110}
                    src={url}
                    style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #e8e8e8' }}
                  />
                ))}
              </Space>
            </Image.PreviewGroup>
          </div>
        )}

        {documentFiles.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              PDF 或文档附件 ({documentFiles.length} 份)
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              {documentFiles.map((url, idx) => {
                const fileName = url.split('/').pop() || `附件_${idx + 1}`
                return (
                  <Card key={idx} size="small" style={{ background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                        <Text ellipsis style={{ maxWidth: 360 }}>
                          {fileName}
                        </Text>
                      </Space>
                      <Button
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        href={url}
                        target="_blank"
                      >
                        在线查看 / 下载
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </Space>
          </div>
        )}

        {pictureFiles.length === 0 && documentFiles.length === 0 && (
          <Empty description="该报告暂无可预览的附件" />
        )}
      </Modal>

      {/* 报告诊评意见弹窗 */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>体检报告临床诊评</span>
          </Space>
        }
        open={Boolean(selectedReportForEval)}
        onCancel={() => setSelectedReportForEval(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedReportForEval(null)}>
            确认
          </Button>,
        ]}
        width={560}
      >
        {selectedReportForEval && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="报告编号">
                {selectedReportForEval.reportId || selectedReportForEval.id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="报告类型">
                {selectedReportForEval.reportType === 2
                  ? '理化指标'
                  : selectedReportForEval.reportType === 3
                    ? '免回复无就医记录'
                    : '体检报告'}
              </Descriptions.Item>
              <Descriptions.Item label="体检机构">
                {selectedReportForEval.medicalOrg || '未录入机构'}
              </Descriptions.Item>
              <Descriptions.Item label="体检日期">
                {selectedReportForEval.reportTime || '-'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 6 }}>
              <Text strong style={{ fontSize: 14 }}>
                临床评估与诊评诊断意见：
              </Text>
            </div>
            <div
              style={{
                background: '#f8fafd',
                border: '1px solid #e6f0fa',
                borderRadius: 6,
                padding: '12px 14px',
                minHeight: 120,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: selectedReportForEval.clinicalEvaluation ? '#333' : '#999',
              }}
            >
              {selectedReportForEval.clinicalEvaluation ||
                '该报告暂无医生录入的临床评估意见。'}
            </div>
          </div>
        )}
      </Modal>
    </Drawer>
  )
}
