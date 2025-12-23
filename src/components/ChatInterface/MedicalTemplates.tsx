import React, { useState, useEffect } from 'react'
import { List, Button, Input, Tag, Empty, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { MedicalTemplate } from '@/types'

interface MedicalTemplatesProps {
  onSelectTemplate: (content: string) => void
  onClose: () => void
}

export const MedicalTemplates: React.FC<MedicalTemplatesProps> = ({
  onSelectTemplate,
  onClose,
}) => {
  const [templates, setTemplates] = useState<MedicalTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<MedicalTemplate[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 模拟医嘱模板数据
  const mockTemplates: MedicalTemplate[] = [
    {
      id: '1',
      category: '常规检查',
      title: '血常规检查',
      content:
        '建议您进行血常规检查，以了解血液系统的基本情况。请空腹到医院抽血检查。',
      tags: ['检查', '血液'],
      usageCount: 156,
      createdAt: new Date(),
    },
    {
      id: '2',
      category: '用药指导',
      title: '感冒用药',
      content:
        '根据您的症状，建议服用感冒灵颗粒，每次1袋，每日3次，饭后服用。多喝水，注意休息。',
      tags: ['用药', '感冒'],
      usageCount: 234,
      createdAt: new Date(),
    },
    {
      id: '3',
      category: '生活建议',
      title: '高血压饮食',
      content:
        '建议低盐低脂饮食，每日盐摄入量不超过6克，多吃新鲜蔬菜水果，适量运动，定期监测血压。',
      tags: ['饮食', '高血压'],
      usageCount: 189,
      createdAt: new Date(),
    },
    {
      id: '4',
      category: '复诊提醒',
      title: '一周后复诊',
      content:
        '请您一周后复诊，届时我们将评估治疗效果并调整治疗方案。如有不适请及时联系。',
      tags: ['复诊', '提醒'],
      usageCount: 98,
      createdAt: new Date(),
    },
    {
      id: '5',
      category: '用药指导',
      title: '降压药服用',
      content:
        '请按时服用降压药，每日早晨空腹服用1片，不可随意停药或减量，如有不适请及时联系医生。',
      tags: ['用药', '高血压'],
      usageCount: 167,
      createdAt: new Date(),
    },
    {
      id: '6',
      category: '常规检查',
      title: '心电图检查',
      content:
        '建议您进行心电图检查，以评估心脏功能。检查前请避免剧烈运动，保持心情平静。',
      tags: ['检查', '心脏'],
      usageCount: 123,
      createdAt: new Date(),
    },
  ]

  // 获取模板分类
  const categories = [
    'all',
    ...Array.from(new Set(mockTemplates.map(t => t.category))),
  ]

  useEffect(() => {
    // 模拟加载延迟
    setTimeout(() => {
      setTemplates(mockTemplates)
      setFilteredTemplates(mockTemplates)
      setLoading(false)
    }, 500)
  }, [])

  // 搜索和筛选
  useEffect(() => {
    let filtered = templates

    // 按分类筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }

    // 按关键词搜索
    if (searchValue) {
      filtered = filtered.filter(
        t =>
          t.title.includes(searchValue) ||
          t.content.includes(searchValue) ||
          t.tags.some(tag => tag.includes(searchValue))
      )
    }

    setFilteredTemplates(filtered)
  }, [templates, selectedCategory, searchValue])

  const handleSelectTemplate = (template: MedicalTemplate) => {
    onSelectTemplate(template.content)
    onClose()
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spin />
        <p>加载模板中...</p>
      </div>
    )
  }

  return (
    <div className="medical-templates" style={{ width: 400, maxHeight: 500 }}>
      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索模板..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          allowClear
        />
      </div>

      {/* 分类标签 */}
      <div style={{ marginBottom: 16 }}>
        {categories.map(category => (
          <Tag
            key={category}
            color={selectedCategory === category ? 'blue' : 'default'}
            style={{ cursor: 'pointer', marginBottom: 4 }}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? '全部' : category}
          </Tag>
        ))}
      </div>

      {/* 模板列表 */}
      {filteredTemplates.length === 0 ? (
        <Empty description="暂无匹配的模板" />
      ) : (
        <List
          size="small"
          dataSource={filteredTemplates}
          renderItem={template => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 0' }}
              onClick={() => handleSelectTemplate(template)}
            >
              <List.Item.Meta
                title={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{template.title}</span>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      使用 {template.usageCount} 次
                    </span>
                  </div>
                }
                description={
                  <div>
                    <div
                      style={{
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {template.content}
                    </div>
                    <div>
                      {template.tags.map(tag => (
                        <Tag key={tag} size="small" color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
