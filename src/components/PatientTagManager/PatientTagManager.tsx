import React, { useState, useEffect } from 'react'
import {
  Drawer,
  Tag,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  message,
  Card,
  Row,
  Col,
} from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import type { Patient } from '@/types'

const { Title, Text } = Typography

interface PatientTagManagerProps {
  patient: Patient
  visible: boolean
  allTags: string[]
  onClose: () => void
  onUpdateTags: (patientId: string, tags: string[]) => Promise<void>
}

export const PatientTagManager: React.FC<PatientTagManagerProps> = ({
  patient,
  visible,
  allTags,
  onClose,
  onUpdateTags,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [loading, setLoading] = useState(false)

  // 初始化选中的标签
  useEffect(() => {
    if (visible && patient) {
      setSelectedTags([...patient.tags])
    }
  }, [visible, patient])

  // 添加标签
  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag])
    }
  }

  // 移除标签
  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove))
  }

  // 添加新标签
  const handleAddNewTag = () => {
    const trimmedTag = newTagInput.trim()
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag])
      setNewTagInput('')
    } else if (selectedTags.includes(trimmedTag)) {
      message.warning('标签已存在')
    }
  }

  // 保存标签
  const handleSave = async () => {
    setLoading(true)
    try {
      await onUpdateTags(patient.id, selectedTags)
    } catch (error) {
      console.error('Update tags failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 重置标签
  const handleReset = () => {
    setSelectedTags([...patient.tags])
    setNewTagInput('')
  }

  // 获取可用的标签（排除已选中的）
  const availableTags = allTags.filter(tag => !selectedTags.includes(tag))

  // 获取常用标签
  const commonTags = [
    '高血压',
    '糖尿病',
    '心脏病',
    '哮喘',
    '过敏',
    '孕期检查',
    '儿科',
    '老年病',
    '慢性病',
    '急诊',
  ]

  return (
    <Drawer
      title={`管理标签 - ${patient?.name}`}
      placement="right"
      onClose={onClose}
      open={visible}
      width={400}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" loading={loading} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 当前标签 */}
        <Card title="当前标签" size="small">
          {selectedTags.length > 0 ? (
            <Space wrap>
              {selectedTags.map(tag => (
                <Tag
                  key={tag}
                  closable
                  color="blue"
                  onClose={() => handleRemoveTag(tag)}
                  closeIcon={<CloseOutlined />}
                >
                  {tag}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">暂无标签</Text>
          )}
        </Card>

        {/* 添加新标签 */}
        <Card title="添加新标签" size="small">
          <Row gutter={8}>
            <Col flex="auto">
              <Input
                placeholder="输入新标签名称"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onPressEnter={handleAddNewTag}
                maxLength={20}
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddNewTag}
                disabled={!newTagInput.trim()}
              >
                添加
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 常用标签 */}
        <Card title="常用标签" size="small">
          <Space wrap>
            {commonTags
              .filter(tag => !selectedTags.includes(tag))
              .map(tag => (
                <Tag
                  key={tag}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleAddTag(tag)}
                >
                  + {tag}
                </Tag>
              ))}
          </Space>
        </Card>

        {/* 已有标签 */}
        {availableTags.length > 0 && (
          <Card title="系统标签" size="small">
            <Space wrap>
              {availableTags.map(tag => (
                <Tag
                  key={tag}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleAddTag(tag)}
                >
                  + {tag}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        <Divider />

        <div>
          <Title level={5}>标签使用说明</Title>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              <Text type="secondary">标签用于快速分类和筛选患者</Text>
            </li>
            <li>
              <Text type="secondary">可以添加疾病、症状、特殊情况等标签</Text>
            </li>
            <li>
              <Text type="secondary">标签名称不超过20个字符</Text>
            </li>
            <li>
              <Text type="secondary">点击常用标签或系统标签可快速添加</Text>
            </li>
          </ul>
        </div>
      </Space>
    </Drawer>
  )
}
