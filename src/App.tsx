import React, { Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAuth } from '@/hooks'
import './App.css'

// 懒加载页面组件
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'))
const PatientListPage = lazy(() => import('@/pages/PatientListPage'))
const ConsultationPage = lazy(() => import('@/pages/ConsultationPage'))
const ConsultationManagementPage = lazy(
  () => import('@/pages/ConsultationManagementPage')
)

// 加载指示器组件
const PageLoader: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <Spin size="large" tip="加载中..." />
  </div>
)

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// 公共路由组件（已登录用户不能访问）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/workspace" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <WorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients"
              element={
                <ProtectedRoute>
                  <PatientListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/consultation/:id"
              element={
                <ProtectedRoute>
                  <ConsultationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/consultations"
              element={
                <ProtectedRoute>
                  <ConsultationManagementPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/workspace" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ConfigProvider>
  )
}

export default App
