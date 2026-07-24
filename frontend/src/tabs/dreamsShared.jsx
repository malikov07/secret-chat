import { useState } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { useMediaViewer } from '../components/MediaViewer'

export const DREAM_EMOJI = ['🌙', '✨', '💭', '🌈', '⭐', '🦋', '🌸', '🔮', '☁️', '💫', '🏝️', '🏡']
const today = () => new Date().toISOString().slice(0, 10)
export const isVideo = (url) => !!url && /\.(mp4|webm|mov|m4v|ogg)$/i.test(url)

const itemsOf = (d) => (d.media_items?.length
  ? d.media_items
  : (d.media_url ? [{ url: d.media_url, type: isVideo(d.media_url) ? 'video' : 'image' }] : []))

export function DreamCard({ dream, onClick }) {
  const items = itemsOf(dream)
  const cover = items[0]
  return (
    <div className="dream-card" onClick={onClick} style={{ cursor: 'pointer', position: 'relative' }}>
      <div className="demoji">{dream.emoji || '🌙'}</div>
      <h3>{dream.title}</h3>
      {dream.body && <div className="body">{dream.body.slice(0, 120)}{dream.body.length > 120 ? '…' : ''}</div>}
      {cover && (cover.type === 'video' ? <video src={cover.url} muted /> : <img src={cover.url} alt="" />)}
      {items.length > 1 && <span className="count-badge">🖼 {items.length}</span>}
      <div className="foot">
        <span>by {dream.created_by_name}</span>
        {dream.is_achieved && <span className="badge-achieved" style={{ marginLeft: 'auto' }}>🏆 Achieved</span>}
      </div>
    </div>
  )
}

export function DreamDetail({ dream, onClose, onEdit, onDelete, onAchieve }) {
  const mv = useMediaViewer()
  const items = itemsOf(dream)
  const gallery = (arr) => (
    <div className="gallery">
      {arr.map((it, i) => it.type === 'video'
        ? <video key={i} src={it.url} controls />
        : <img key={i} src={it.url} alt="" onClick={() => mv.open(it.url, 'image')} />)}
    </div>
  )
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize: 40, textAlign: 'center' }}>{dream.emoji || '🌙'}</div>
      <h2 style={{ textAlign: 'center' }}>{dream.title}</h2>
      {dream.is_achieved && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <span className="badge-achieved">🏆 Achieved{dream.achieved_date ? ` · ${dream.achieved_date}` : ''}</span>
        </div>
      )}
      {items.length > 0 && gallery(items)}
      {dream.body && <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dream.body}</p>}

      {dream.is_achieved && (dream.achievement_note || dream.achievement_media_url) && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
          <b>How it came true</b>
          {dream.achievement_media_url && gallery([{ url: dream.achievement_media_url, type: isVideo(dream.achievement_media_url) ? 'video' : 'image' }])}
          {dream.achievement_note && <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{dream.achievement_note}</p>}
        </div>
      )}

      <div className="row">
        <button className="btn btn-ghost" onClick={onDelete}>🗑️ Delete</button>
        <button className="btn btn-ghost" onClick={onEdit}>✏️ Edit</button>
        {!dream.is_achieved && <button className="btn btn-primary" onClick={onAchieve}>🏆 Achieved</button>}
      </div>
    </Modal>
  )
}

export function DreamForm({ dream, onClose, onSaved }) {
  const [f, setF] = useState({ title: dream?.title || '', body: dream?.body || '', emoji: dream?.emoji || '🌙' })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!f.title.trim()) return
    setBusy(true)
    const form = new FormData()
    form.append('title', f.title)
    form.append('body', f.body)
    form.append('emoji', f.emoji)
    files.forEach((file) => form.append('media', file))
    try {
      if (dream) await api.patchForm(`/dreams/${dream.id}`, form)
      else await api.postForm('/dreams', form)
      onSaved()
    } catch (e) { alert(e.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose}>
      <h2>{dream ? 'Edit dream' : 'Record a dream'}</h2>
      <div className="form-grid">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DREAM_EMOJI.map((e) => (
            <button key={e} onClick={() => setF({ ...f, emoji: e })}
                    style={{ fontSize: 22, padding: 6, borderRadius: 10, background: f.emoji === e ? 'var(--panel-hover)' : 'transparent' }}>{e}</button>
          ))}
        </div>
        <input className="field" placeholder="Dream title" value={f.title}
               onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className="field" rows={4} placeholder="What did you dream about?"
                  value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <input type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles([...e.target.files])} />
        {files.length > 0 && <small style={{ color: 'var(--text-dim)' }}>{files.length} file(s) selected</small>}
      </div>
      <div className="row">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button>
      </div>
    </Modal>
  )
}

export function AchievementForm({ dream, onClose, onSaved }) {
  const [note, setNote] = useState(dream.achievement_note || '')
  const [date, setDate] = useState(dream.achieved_date || today())
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const form = new FormData()
    form.append('is_achieved', 'true')
    form.append('achieved_date', date)
    form.append('achievement_note', note)
    if (file) form.append('achievement_media', file)
    try { await api.patchForm(`/dreams/${dream.id}`, form); onSaved() }
    catch (e) { alert(e.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose}>
      <h2>🏆 Dream achieved!</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>“{dream.title}” — tell the story of how it came true.</p>
      <div className="form-grid">
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <textarea className="field" rows={3} placeholder="How did it happen?"
                  value={note} onChange={(e) => setNote(e.target.value)} />
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files[0])} />
      </div>
      <div className="row">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save achievement'}</button>
      </div>
    </Modal>
  )
}
