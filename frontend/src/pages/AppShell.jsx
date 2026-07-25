import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useLive } from '../live/LiveProvider'
import ChatTab from '../tabs/ChatTab'
import MemoriesTab from '../tabs/MemoriesTab'
import DreamsTab from '../tabs/DreamsTab'
import AchievedTab from '../tabs/AchievedTab'
import SettingsTab from '../tabs/SettingsTab'
import LiveDock from '../live/LiveDock'

const TABS = [
  { key: 'chat', icon: '💬', label: 'Chat' },
  { key: 'memories', icon: '📸', label: 'Memories' },
  { key: 'dreams', icon: '🌙', label: 'Dreams' },
  { key: 'achieved', icon: '🏆', label: 'Achieved' },
]

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)
const GearIcon = () => (
  <svg className="rail-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
const LogoutIcon = () => (
  <svg className="rail-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

export default function AppShell() {
  const { user, logout } = useAuth()
  const live = useLive()
  const nav = useNavigate()
  const [tab, setTab] = useState('chat')
  const [drawer, setDrawer] = useState(false)

  const showDock = !!live.viewer
  useEffect(() => { if (showDock) setTab('chat') }, [showDock])

  const go = (key) => { setTab(key); setDrawer(false) }

  return (
    <div className={`shell ${showDock ? 'live' : ''}`}>
      <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Menu"><MenuIcon /></button>
      {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}

      <div className={`rail ${drawer ? 'open' : ''}`}>
        <div className="rail-logo">💞</div>
        {TABS.map((t) => (
          <button key={t.key} className={`rail-tab ${tab === t.key ? 'active' : ''}`} onClick={() => go(t.key)}>
            <span>{t.icon}</span>
            <span className="rail-label">{t.label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className={`rail-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => go('settings')} title="Settings">
          <GearIcon /><span className="rail-label">Settings</span>
        </button>
        {user.role === 'admin' && (
          <button className="rail-tab" onClick={() => { setDrawer(false); nav('/admin') }} title="Admin">
            <span>⚙️</span><span className="rail-label">Admin</span>
          </button>
        )}
        <button className="rail-tab" onClick={logout} title="Log out">
          <LogoutIcon /><span className="rail-label">Log out</span>
        </button>
      </div>

      <div className="main">
        {tab === 'chat' && <ChatTab />}
        {tab === 'memories' && <MemoriesTab />}
        {tab === 'dreams' && <DreamsTab />}
        {tab === 'achieved' && <AchievedTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {showDock && <LiveDock />}
    </div>
  )
}
