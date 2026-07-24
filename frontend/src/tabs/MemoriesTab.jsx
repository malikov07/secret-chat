import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'
import { useMediaViewer } from '../components/MediaViewer'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const fmt = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const pretty = (ds) => new Date(ds).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })

const itemsOf = (s) => (s.media_items?.length
  ? s.media_items
  : (s.media_url ? [{ url: s.media_url, type: s.media_type || 'image' }] : []))

export default function MemoriesTab() {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [stories, setStories] = useState([])
  const [filterDate, setFilterDate] = useState(null)
  const [detail, setDetail] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try { setStories(await api.get('/calendar/stories')) } catch { /* ignore */ }
  }, [])
  useEffect(() => { load() }, [load])

  const marked = useMemo(() => new Set(stories.map((s) => s.date)), [stories])
  const list = filterDate ? stories.filter((s) => s.date === filterDate) : stories

  const first = new Date(cursor.y, cursor.m, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const move = (d) => {
    let m = cursor.m + d, y = cursor.y
    if (m < 0) { m = 11; y-- } if (m > 11) { m = 0; y++ }
    setCursor({ y, m })
  }
  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="pad">
      <div className="section-head"><h1>📸 Our Memories</h1><div className="grow" /></div>
      <div className="mem-layout">
        <div className="mem-list">
          {filterDate && (
            <div className="chip" style={{ cursor: 'pointer' }} onClick={() => setFilterDate(null)}>
              📅 {pretty(filterDate)} · show all ✕
            </div>
          )}
          {list.length === 0 && <div className="empty">No memories yet. Add your first one 💞</div>}
          {list.map((s) => {
            const items = itemsOf(s)
            const cover = items[0]
            return (
              <div className="mem-card" key={s.id} onClick={() => setDetail(s)}>
                {cover && (
                  <div className="media-wrap">
                    {cover.type === 'video' ? <video src={cover.url} muted /> : <img src={cover.url} alt="" />}
                    {items.length > 1 && <span className="count-badge">🖼 {items.length}</span>}
                  </div>
                )}
                <div className="mc-body">
                  <div className="mc-date">{pretty(s.date)}</div>
                  {s.caption && <div className="mc-text">{s.caption}</div>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mem-side">
          <div className="cal-card">
            <div className="cal-nav">
              <button className="icon-btn" onClick={() => move(-1)}>‹</button>
              <h3>{MONTHS[cursor.m]} {cursor.y}</h3>
              <button className="icon-btn" onClick={() => move(1)}>›</button>
            </div>
            <div className="cal-grid">
              {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const ds = fmt(cursor.y, cursor.m, d)
                return (
                  <div key={i}
                       className={`cal-cell ${ds === filterDate ? 'selected' : ''} ${ds === todayStr ? 'today' : ''}`}
                       onClick={() => setFilterDate(ds === filterDate ? null : ds)}>
                    <span>{d}</span>
                    {marked.has(ds) && <div className="dots"><span className="dot" /></div>}
                  </div>
                )
              })}
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setAdding(true)}>+ Add memory</button>
        </div>
      </div>

      {detail && (
        <MemoryDetail story={detail} onClose={() => setDetail(null)}
                      onEdit={() => { setEditing(detail); setDetail(null) }}
                      onDelete={async () => { await api.del(`/calendar/stories/${detail.id}`); setDetail(null); load() }} />
      )}
      {adding && <MemoryForm initialDate={filterDate || todayStr} onClose={() => setAdding(false)}
                             onSaved={() => { setAdding(false); load() }} />}
      {editing && <MemoryForm story={editing} onClose={() => setEditing(null)}
                              onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function MemoryDetail({ story, onClose, onEdit, onDelete }) {
  const mv = useMediaViewer()
  const items = itemsOf(story)
  return (
    <Modal onClose={onClose}>
      <h2>{pretty(story.date)}</h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>by {story.created_by_name}</div>
      {items.length > 0 && (
        <div className="gallery">
          {items.map((it, i) => it.type === 'video'
            ? <video key={i} src={it.url} controls />
            : <img key={i} src={it.url} alt="" onClick={() => mv.open(it.url, 'image')} />)}
        </div>
      )}
      {story.caption && <p style={{ lineHeight: 1.5 }}>{story.caption}</p>}
      <div className="row">
        <button className="btn btn-ghost" onClick={onDelete}>🗑️ Delete</button>
        <button className="btn btn-primary" onClick={onEdit}>✏️ Edit</button>
      </div>
    </Modal>
  )
}

function MemoryForm({ story, initialDate, onClose, onSaved }) {
  const [date, setDate] = useState(story?.date || initialDate)
  const [caption, setCaption] = useState(story?.caption || '')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const form = new FormData()
    form.append('date', date)
    form.append('caption', caption)
    files.forEach((f) => form.append('media', f))
    try {
      if (story) await api.patchForm(`/calendar/stories/${story.id}`, form)
      else await api.postForm('/calendar/stories', form)
      onSaved()
    } catch (e) { alert(e.message); setBusy(false) }
  }

  return (
    <Modal onClose={onClose}>
      <h2>{story ? 'Edit memory' : 'New memory'}</h2>
      <div className="form-grid">
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <textarea className="field" rows={3} placeholder="Write about this moment…"
                  value={caption} onChange={(e) => setCaption(e.target.value)} />
        <input type="file" accept="image/*,video/*" multiple
               onChange={(e) => setFiles([...e.target.files])} />
        {files.length > 0 && <small style={{ color: 'var(--text-dim)' }}>{files.length} file(s) selected</small>}
        {story && <small style={{ color: 'var(--text-dim)' }}>New files are added to this memory.</small>}
      </div>
      <div className="row">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button>
      </div>
    </Modal>
  )
}
