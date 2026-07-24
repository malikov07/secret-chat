import { useState } from 'react'
import { useAuth } from '../auth'
import PermissionGate from './PermissionGate'
import PairScreen from './PairScreen'
import AppShell from './AppShell'
import { LiveProvider } from '../live/LiveProvider'
import { SettingsProvider } from '../settings'
import { MediaViewerProvider } from '../components/MediaViewer'

export default function Home() {
  const { user } = useAuth()
  const [permSeen, setPermSeen] = useState(localStorage.getItem('sc_perm_seen') === '1')

  if (!permSeen) return <PermissionGate onDone={() => setPermSeen(true)} />
  if (!user.partner) return <PairScreen />
  return (
    <SettingsProvider>
      <MediaViewerProvider>
        <LiveProvider>
          <AppShell />
        </LiveProvider>
      </MediaViewerProvider>
    </SettingsProvider>
  )
}
