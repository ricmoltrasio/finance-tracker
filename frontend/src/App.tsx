import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Sidebar } from './components/layout/Sidebar'
import { BottomNav } from './components/layout/BottomNav'
import { Spinner } from './components/common/Spinner'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import Import from './pages/Import'
import Settings from './pages/Settings'
import Budget from './pages/Budget'
import NotFound from './pages/NotFound'

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  )
}
