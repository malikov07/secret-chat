import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth'

const DEFAULTS = { bgImage: '', fontSize: 15, fontFamily: 'system', superMode: true }
const KEY = (uid) => `sc_prefs_${uid}`

export const FONTS = {
  system: '-apple-system, "Segoe UI", Roboto, sans-serif',
  rounded: '"Segoe UI Rounded", "Nunito", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", Consolas, monospace',
}

const Ctx = createContext(null)
export const useSettings = () => useContext(Ctx)

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(DEFAULTS)

  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem(KEY(user.id))
      setPrefs(raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS)
    } catch { setPrefs(DEFAULTS) }
  }, [user?.id])

  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try { localStorage.setItem(KEY(user.id), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [user?.id])

  return <Ctx.Provider value={{ prefs, update }}>{children}</Ctx.Provider>
}
