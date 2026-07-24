import { useState, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useSettings, FONTS } from '../settings'
import Avatar from '../components/Avatar'

// Downscale an image file to a compact data URL (keeps localStorage small).
function fileToScaledDataUrl(file, maxW = 1280) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = URL.createObjectURL(file)
  })
}

function Switch({ on, onChange }) {
  return <div className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><div className="knob" /></div>
}

export default function SettingsTab() {
  const { user, setUser } = useAuth()
  const { prefs, update } = useSettings()
  const [name, setName] = useState(user.display_name || '')
  const [saved, setSaved] = useState('')
  const avatarRef = useRef(null)
  const bgRef = useRef(null)
  const canSuper = user.role === 'subadmin' || user.role === 'admin'

  const flash = (t) => { setSaved(t); setTimeout(() => setSaved(''), 1800) }

  const saveName = async () => {
    try { const me = await api.patch('/me', { display_name: name }); setUser(me); flash('Name saved') }
    catch (e) { alert(e.message) }
  }
  const onAvatar = async (file) => {
    if (!file) return
    const form = new FormData(); form.append('avatar', file)
    try { const me = await api.patchForm('/me', form); setUser(me); flash('Photo updated') }
    catch (e) { alert(e.message) }
  }
  const onBg = async (file) => {
    if (!file) return
    const url = await fileToScaledDataUrl(file)
    try { update({ bgImage: url }); flash('Background set') }
    catch { alert('Image too large — try a smaller one.') }
  }

  return (
    <div className="pad">
      <div className="settings-wrap">
        <div className="section-head"><h1>⚙️ Settings</h1><div className="grow" />
          {saved && <span className="chip" style={{ color: 'var(--online)' }}>{saved}</span>}
        </div>

        <div className="settings-card">
          <h3>Profile</h3>
          <div className="set-row">
            <div className="avatar-edit" onClick={() => avatarRef.current?.click()}>
              <Avatar user={user} size={64} />
              <div className="cam">📷</div>
            </div>
            <div className="grow">
              <b>{user.name}</b>
              <small>{user.phone} · tap the photo to change</small>
            </div>
            <input ref={avatarRef} type="file" hidden accept="image/*"
                   onChange={(e) => onAvatar(e.target.files[0])} />
          </div>
          <div className="set-row">
            <div className="grow">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="Your name" />
            </div>
            <button className="btn btn-primary" onClick={saveName}>Save</button>
          </div>
        </div>

        <div className="settings-card">
          <h3>Chat appearance</h3>
          <div className="set-row">
            <div className="grow"><b>Background image</b><small>Shown behind your messages</small></div>
            {prefs.bgImage
              ? <img className="bg-thumb" src={prefs.bgImage} alt="" />
              : <div className="bg-thumb" />}
            <button className="btn btn-ghost" onClick={() => bgRef.current?.click()}>Upload</button>
            {prefs.bgImage && <button className="icon-btn" onClick={() => update({ bgImage: '' })}>✕</button>}
            <input ref={bgRef} type="file" hidden accept="image/*" onChange={(e) => onBg(e.target.files[0])} />
          </div>
          <div className="set-row" style={{ display: 'block' }}>
            <b>Font</b>
            <div className="seg" style={{ marginTop: 8 }}>
              {Object.keys(FONTS).map((f) => (
                <button key={f} className={prefs.fontFamily === f ? 'active' : ''}
                        onClick={() => update({ fontFamily: f })} style={{ fontFamily: FONTS[f] }}>
                  {f}
                </button>
              ))}
            </div>
            <div className="font-sample" style={{ fontFamily: FONTS[prefs.fontFamily], fontSize: prefs.fontSize }}>
              The quick brown fox loves you 💕
            </div>
          </div>
          <div className="set-row">
            <div className="grow"><b>Font size</b><small>{prefs.fontSize}px</small></div>
            <input type="range" min="12" max="22" value={prefs.fontSize}
                   onChange={(e) => update({ fontSize: Number(e.target.value) })} />
          </div>
        </div>

        {canSuper && (
          <div className="settings-card">
            <h3>Sub-admin</h3>
            <div className="set-row">
              <div className="grow">
                <b>Live sharing tools</b>
                <small>Show the 📹 / 📍 buttons to request your partner's live camera+mic
                  or location. They always have to accept — this just shows/hides the buttons.</small>
              </div>
              <Switch on={prefs.superMode} onChange={(v) => update({ superMode: v })} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
