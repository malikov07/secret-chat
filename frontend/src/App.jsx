import { Routes, Route } from 'react-router-dom'
import { useAuth } from './auth'
import AuthPage from './pages/AuthPage'
import Home from './pages/Home'
import AdminPage from './pages/AdminPage'
import './App.css'

function Splash() {
  return <div className="splash"><div className="heart">💗</div></div>
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <AuthPage />
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/*" element={<Home />} />
    </Routes>
  )
}
