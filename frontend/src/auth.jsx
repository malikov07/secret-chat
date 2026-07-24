import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, tokens } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!tokens.access) { setUser(null); return null }
    try {
      const me = await api.get('/me')
      setUser(me)
      return me
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    (async () => {
      await refreshUser()
      setLoading(false)
    })()
  }, [refreshUser])

  const login = async (phone, password) => {
    const data = await api.post('/auth/login', { phone, password }, { auth: false })
    tokens.set({ access: data.access, refresh: data.refresh })
    setUser(data.user)
    return data.user
  }

  const register = async (phone, password, display_name) => {
    await api.post('/auth/register', { phone, password, display_name }, { auth: false })
    return login(phone, password)
  }

  const logout = () => { tokens.clear(); setUser(null) }

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  )
}
