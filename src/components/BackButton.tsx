import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

interface BackButtonProps {
  to?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

export const BackButton: React.FC<BackButtonProps> = ({
  to,
  style,
  children,
}) => {
  const navigate = useNavigate()

  const handleBack = () => {
    if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <Button
      type="text"
      icon={<ArrowLeftOutlined />}
      onClick={handleBack}
      style={style}
    >
      {children || '返回'}
    </Button>
  )
}
