import { useState } from 'react'

const ITEMS = [
  { emoji: '📷', title: 'Camera', desc: 'Send photos & videos, and — only when you accept — share live video.' },
  { emoji: '🎙️', title: 'Microphone', desc: 'Record voice messages, and share live audio when you choose to.' },
  { emoji: '📍', title: 'Location', desc: 'Share your live location on a map — only when you turn it on.' },
]

export default function PermissionGate({ onDone }) {
  const [busy, setBusy] = useState(false)

  const allow = async () => {
    setBusy(true)
    // Ask the browser for the permissions up front so they're ready later.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch { /* user may deny; that's fine */ }
    try {
      await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(() => res(), () => res(), { timeout: 8000 }))
    } catch { /* ignore */ }
    localStorage.setItem('sc_perm_seen', '1')
    setBusy(false)
    onDone()
  }

  const skip = () => { localStorage.setItem('sc_perm_seen', '1'); onDone() }

  return (
    <div className="perm-wrap">
      <div className="perm-card">
        <div className="perm-emoji">🔐💞</div>
        <h2>Welcome to Secret</h2>
        <p className="lead">To share everything with each other, Secret would like to use:</p>
        <div className="perm-list">
          {ITEMS.map((it) => (
            <div className="perm-item" key={it.title}>
              <div className="pi-emoji">{it.emoji}</div>
              <div>
                <h4>{it.title}</h4>
                <small>{it.desc}</small>
              </div>
            </div>
          ))}
        </div>
        <p className="perm-note">
          Nothing turns on secretly. Your camera, mic, or location only go live when
          <b> you accept a request</b>, and while they're on you'll always see a red banner
          and can stop instantly.
        </p>
        <button className="btn btn-primary btn-block" onClick={allow} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Allow access'}
        </button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={skip}>
          Maybe later
        </button>
      </div>
    </div>
  )
}
