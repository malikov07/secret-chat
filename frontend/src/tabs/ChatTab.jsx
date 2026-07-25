import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { openSocket } from '../realtime'
import { useLive } from '../live/LiveProvider'
import { useSettings, FONTS } from '../settings'
import { useMediaViewer } from '../components/MediaViewer'
import Avatar from '../components/Avatar'
import EmojiPicker from '../components/EmojiPicker'
import { REACTIONS } from '../emoji'

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const dayKey = (iso) => new Date(iso).toDateString()
const dayLabel = (iso) => {
  const d = new Date(iso); const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' })
}
const isEmojiOnly = (t) => {
  if (!t) return false
  const s = t.replace(/\s/g, '')
  return s.length <= 8 && /\p{Extended_Pictographic}/u.test(s) && !/[a-z0-9]/i.test(s)
}
const lastSeenText = (u) => {
  if (u.is_online) return 'online'
  if (!u.last_seen) return 'offline'
  return `last seen ${new Date(u.last_seen).toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${time(u.last_seen)}`
}

export default function ChatTab() {
  const { user } = useAuth()
  const live = useLive()
  const { prefs } = useSettings()
  const [partner, setPartner] = useState(user.partner)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [typing, setTyping] = useState(false)
  const [recording, setRecording] = useState(false)
  const [vnote, setVnote] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const sockRef = useRef(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const recRef = useRef(null)
  const typingTimer = useRef(null)
  const canLiveControl = (user.role === 'subadmin' || user.role === 'admin') && prefs.superMode

  const upsert = useCallback((m) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      if (i >= 0) { const copy = [...prev]; copy[i] = m; return copy }
      return [...prev, m]
    })
  }, [])
  const markRead = useCallback(() => { api.post('/chat/read').catch(() => {}) }, [])

  useEffect(() => {
    (async () => {
      try {
        const conv = await api.get('/chat/conversation')
        if (conv?.partner) setPartner(conv.partner)
        const data = await api.get('/chat/messages?limit=60')
        setMessages(data.results || [])
        markRead()
      } catch { /* ignore */ }
    })()
    const sock = openSocket('/ws/chat/', (ev) => {
      if (ev.event === 'message') {
        upsert(ev.message)
        if (ev.message.sender.id !== user.id) markRead()
      } else if (ev.event === 'update') {
        upsert(ev.message)
      } else if (ev.event === 'read') {
        if (ev.reader_id !== user.id) {
          setMessages((prev) => prev.map((m) => ev.message_ids.includes(m.id) ? { ...m, is_read: true } : m))
        }
      } else if (ev.event === 'typing') {
        setTyping(ev.is_typing)
      } else if (ev.event === 'presence') {
        setPartner((p) => p && p.id === ev.user_id ? { ...p, is_online: ev.is_online, last_seen: ev.last_seen } : p)
      }
    })
    sockRef.current = sock
    return () => sock.close()
  }, [user.id, upsert, markRead])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const sendTyping = (t) => sockRef.current?.send({ action: 'typing', is_typing: t })
  const onType = (e) => {
    setText(e.target.value); sendTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => sendTyping(false), 1500)
  }

  const sendText = async () => {
    const body = text.trim()
    if (!body) return
    setText(''); setShowEmoji(false); sendTyping(false)
    const form = new FormData()
    form.append('text', body)
    if (replyTo) form.append('reply_to', replyTo.id)
    setReplyTo(null)
    try { await api.postForm('/chat/messages', form) } catch (e) { alert(e.message) }
  }
  const sendFile = async (file) => {
    if (!file) return
    const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'file'
    const form = new FormData()
    form.append('media', file); form.append('type', type)
    if (replyTo) form.append('reply_to', replyTo.id)
    setReplyTo(null)
    try { await api.postForm('/chat/messages', form) } catch (e) { alert(e.message) }
  }
  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream); const chunks = []; const started = Date.now()
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); setRecording(false)
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const form = new FormData()
        form.append('media', blob, 'voice.webm'); form.append('type', 'voice')
        form.append('duration', ((Date.now() - started) / 1000).toFixed(1))
        try { await api.postForm('/chat/messages', form) } catch (e) { alert(e.message) }
      }
      recRef.current = rec; rec.start(); setRecording(true)
    } catch { alert('Microphone not available.') }
  }

  const sendVideoNote = async (blob, duration) => {
    setVnote(false)
    const form = new FormData()
    form.append('media', blob, 'videonote.webm')
    form.append('type', 'video_note')
    form.append('duration', duration.toFixed(1))
    try { await api.postForm('/chat/messages', form) } catch (e) { alert(e.message) }
  }

  const react = async (m, emoji) => {
    const value = m.reaction === emoji ? '' : emoji
    try { await api.patch(`/chat/messages/${m.id}`, { reaction: value }) } catch { /* ignore */ }
  }
  const editMsg = async (m, newText) => {
    const t = newText.trim()
    if (!t || t === m.text) return
    try { await api.patch(`/chat/messages/${m.id}`, { text: t }) } catch (e) { alert(e.message) }
  }
  const del = async (m) => { try { await api.del(`/chat/messages/${m.id}`) } catch { /* ignore */ } }

  const bgStyle = {
    '--chat-font': `${prefs.fontSize}px`,
    fontFamily: FONTS[prefs.fontFamily] || FONTS.system,
    ...(prefs.bgImage ? { backgroundImage: `url(${prefs.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
  }

  let lastDay = null
  return (
    <div className="chat">
      <div className="chat-header">
        <div className="chat-peer" onClick={() => setShowProfile(true)} title="View profile"
             style={{ cursor: 'pointer' }}>
          <Avatar user={partner} size={44} showDot />
          <div>
            <div className="name">{partner.name || partner.display_name || partner.phone}</div>
            <div className={`status ${partner.is_online ? 'online' : ''}`}>{lastSeenText(partner)}</div>
          </div>
        </div>
        <div className="chat-actions">
          {canLiveControl && (
            <>
              <button className="icon-btn" title="Ask to see camera & mic" onClick={() => live.request('watch')}>📹</button>
              <button className="icon-btn" title="Ask for live location" onClick={() => live.request('location')}>📍</button>
            </>
          )}
        </div>
      </div>

      <div className="messages" style={bgStyle}>
        {messages.filter((m) => !m.is_deleted).map((m) => {
          const out = m.sender.id === user.id
          const showDay = dayKey(m.created_at) !== lastDay
          lastDay = dayKey(m.created_at)
          return (
            <div key={m.id}>
              {showDay && <div className="day-sep">{dayLabel(m.created_at)}</div>}
              <MessageBubble m={m} out={out} onReply={() => setReplyTo(m)}
                             onReact={react} onDelete={del} onEdit={editMsg} />
            </div>
          )
        })}
        <div className="typing">{typing ? `${partner.name || 'they'} is typing…` : ''}</div>
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="reply-bar">
          <span style={{ fontSize: 18 }}>↩️</span>
          <div className="grow">
            <span className="rb-name">Replying to {replyTo.sender.id === user.id ? 'yourself' : partner.name}</span>
            {' — '}{replyTo.text || replyTo.type}
          </div>
          <button className="icon-btn" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <div className="composer">
        {showEmoji && <EmojiPicker onPick={(e) => setText((t) => t + e)} onClose={() => setShowEmoji(false)} />}
        <button className="icon-btn" onClick={() => setShowEmoji((s) => !s)}>😊</button>
        <button className="icon-btn" onClick={() => fileRef.current?.click()}>📎</button>
        <button className="icon-btn" onClick={() => setVnote(true)} title="Circle video message">🎥</button>
        <input ref={fileRef} type="file" hidden accept="image/*,video/*"
               onChange={(e) => { sendFile(e.target.files[0]); e.target.value = '' }} />
        <textarea rows={1} value={text} onChange={onType} placeholder="Message…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }} />
        {text.trim()
          ? <button className="send-btn" onClick={sendText}>➤</button>
          : <button className="send-btn" onClick={toggleRecord} title="Voice message"
                    style={recording ? { background: 'var(--danger)' } : undefined}>{recording ? '■' : '🎤'}</button>}
      </div>

      {vnote && <VideoNoteRecorder onClose={() => setVnote(false)} onSend={sendVideoNote} />}
      {showProfile && <ProfilePanel user={partner} onClose={() => setShowProfile(false)} />}
    </div>
  )
}

function MessageBubble({ m, out, onReply, onReact, onDelete, onEdit }) {
  const mv = useMediaViewer()
  const [showReacts, setShowReacts] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.text)

  if (m.is_deleted) return null
  const emojiOnly = m.type === 'text' && isEmojiOnly(m.text)
  const canEdit = out && m.type === 'text'
  const saveEdit = () => { onEdit(m, draft); setEditing(false) }

  if (m.type === 'video_note' && m.media_url) {
    return (
      <SwipeToReply onReply={() => onReply(m)}>
        <div className={`msg-row ${out ? 'out' : 'in'}`}>
          <div className="vnote-msg">
            {!menuOpen && <button className="bubble-menu-btn" onClick={() => setMenuOpen(true)} title="More">⋯</button>}
            {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />}
            <div className={`msg-actions ${menuOpen ? 'open' : ''}`}>
              <button onClick={() => setShowReacts((s) => !s)} title="React">😊</button>
              <button onClick={() => { onReply(m); setMenuOpen(false) }} title="Reply">↩️</button>
              {out && <button onClick={() => { onDelete(m); setMenuOpen(false) }} title="Delete">🗑️</button>}
            </div>
            {showReacts && (
              <div className="msg-actions" style={{ top: -46, display: 'flex' }}>
                {REACTIONS.map((r) => <button key={r} onClick={() => { onReact(m, r); setShowReacts(false) }}>{r}</button>)}
              </div>
            )}
            <VideoNote src={m.media_url} />
            <div className="bubble-meta" style={{ justifyContent: out ? 'flex-end' : 'flex-start', marginTop: 4 }}>
              <span>{time(m.created_at)}</span>
              {out && <span className={`ticks ${m.is_read ? 'read' : ''}`}>{m.is_read ? '✓✓' : '✓'}</span>}
            </div>
            {m.reaction && <div className="reaction-badge" onClick={() => onReact(m, m.reaction)}>{m.reaction}</div>}
          </div>
        </div>
      </SwipeToReply>
    )
  }

  return (
    <SwipeToReply onReply={() => onReply(m)}>
    <div className={`msg-row ${out ? 'out' : 'in'}`}>
      <div className={`bubble ${emojiOnly ? 'emoji-only' : ''}`} onDoubleClick={() => onReact(m, '❤️')}>
        {!editing && (
          <>
            {!menuOpen && <button className="bubble-menu-btn" onClick={() => setMenuOpen(true)} title="More">⋯</button>}
            {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />}
            <div className={`msg-actions ${menuOpen ? 'open' : ''}`}>
              <button onClick={() => setShowReacts((s) => !s)} title="React">😊</button>
              <button onClick={() => { onReply(m); setMenuOpen(false) }} title="Reply">↩️</button>
              {canEdit && <button onClick={() => { setDraft(m.text); setEditing(true); setMenuOpen(false) }} title="Edit">✏️</button>}
              {out && <button onClick={() => { onDelete(m); setMenuOpen(false) }} title="Delete">🗑️</button>}
            </div>
          </>
        )}
        {showReacts && (
          <div className="msg-actions" style={{ top: -46, display: 'flex' }}>
            {REACTIONS.map((r) => <button key={r} onClick={() => { onReact(m, r); setShowReacts(false) }}>{r}</button>)}
          </div>
        )}
        {m.reply_to && (
          <div className="reply-prev">
            <span className="rp-name">{m.reply_to.sender_name}</span>
            <div>{m.reply_to.text || m.reply_to.type}</div>
          </div>
        )}
        {m.type === 'image' && m.media_url &&
          <img className="clickable" src={m.media_url} alt="" onClick={() => mv.open(m.media_url, 'image')} />}
        {m.type === 'video' && m.media_url && <video src={m.media_url} controls />}
        {m.type === 'voice' && m.media_url && <div className="voice">🎙️<audio src={m.media_url} controls /></div>}
        {m.type === 'file' && m.media_url && (
          <a className="file" href={m.media_url} target="_blank" rel="noreferrer">
            <span className="fi">📄</span><span>{m.media_name || 'file'}</span>
          </a>
        )}

        {editing ? (
          <div className="msg-editing">
            <textarea className="field" rows={2} value={draft} autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditing(false) }} />
            <button className="icon-btn" onClick={saveEdit} title="Save">✓</button>
            <button className="icon-btn" onClick={() => setEditing(false)} title="Cancel">✕</button>
          </div>
        ) : (
          m.text && <div className="text">{m.text}</div>
        )}

        <div className="bubble-meta">
          {m.edited_at && <span>edited</span>}
          <span>{time(m.created_at)}</span>
          {out && <span className={`ticks ${m.is_read ? 'read' : ''}`}>{m.is_read ? '✓✓' : '✓'}</span>}
        </div>
        {m.reaction && <div className="reaction-badge" onClick={() => onReact(m, m.reaction)}>{m.reaction}</div>}
      </div>
    </div>
    </SwipeToReply>
  )
}

// Swipe a message left to reply to it (Telegram-style). Touch only.
function SwipeToReply({ onReply, children }) {
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const cur = useRef(0)
  const active = useRef(false)

  const onTouchStart = (e) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    active.current = false
  }
  const onTouchMove = (e) => {
    if (!start.current) return
    const t = e.touches[0]
    const dX = t.clientX - start.current.x
    const dY = t.clientY - start.current.y
    if (!active.current) {
      if (Math.abs(dX) > 10 && Math.abs(dX) > Math.abs(dY)) active.current = true
      else if (Math.abs(dY) > 10) { start.current = null; return }  // vertical scroll — let it be
      else return
    }
    const d = Math.max(-96, Math.min(0, dX))  // left-swipe only
    cur.current = d
    setDx(d)
  }
  const onTouchEnd = () => {
    if (cur.current <= -56) onReply()
    start.current = null; active.current = false; cur.current = 0
    setDx(0)
  }

  return (
    <div className="swipe-wrap" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className={`swipe-hint ${dx <= -56 ? 'armed' : ''}`} style={{ opacity: Math.min(1, -dx / 56) }}>↩</div>
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .18s ease' }}>
        {children}
      </div>
    </div>
  )
}

// Telegram-style contact profile: big avatar, name, presence, and info rows.
function ProfilePanel({ user, onClose }) {
  const initial = (user?.display_name || user?.name || user?.phone || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="profile-scrim" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-top">
          <button className="icon-btn profile-close" onClick={onClose} title="Close">✕</button>
          <div className="profile-avatar">
            {user?.avatar ? <img src={user.avatar} alt="" /> : <span>{initial}</span>}
          </div>
          <div className="profile-name">{user.name || user.display_name || user.phone}</div>
          <div className={`profile-status ${user.is_online ? 'online' : ''}`}>{lastSeenText(user)}</div>
        </div>
        <div className="profile-list">
          <div className="profile-item">
            <span className="pi-icon">📞</span>
            <div className="pi-body">
              <div className="pi-value">{user.phone}</div>
              <div className="pi-label">Phone</div>
            </div>
          </div>
          <div className="profile-item">
            <span className="pi-icon">💞</span>
            <div className="pi-body">
              <div className="pi-value">Partner</div>
              <div className="pi-label">Your one and only</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Circular video message — click to play with sound, replays paused after end.
function VideoNote({ src }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) { v.muted = false; v.play().catch(() => {}); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }
  return (
    <div className="video-note-wrap">
      <video ref={ref} className="video-note" src={src} playsInline
             onClick={toggle} onEnded={() => setPlaying(false)} />
      {!playing && <div className="video-note-play"><span>▶</span></div>}
    </div>
  )
}

function pickMime() {
  const opts = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  for (const o of opts) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(o)) return o
  }
  return ''
}

// Records a short round video message (max 60s) and sends it.
function VideoNoteRecorder({ onClose, onSend }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const chunks = useRef([])
  const timerRef = useRef(null)
  const startedRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 }, audio: true })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = s
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}) }
      })
      .catch(() => { alert('Camera/microphone not available.'); onClose() })
    return () => {
      active = false
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    clearInterval(timerRef.current)
    try { recRef.current?.stop() } catch { /* ignore */ }
    setRecording(false)
  }
  const start = () => {
    if (!streamRef.current) return
    chunks.current = []
    const mime = pickMime()
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'video/webm' })
      onSend(blob, (Date.now() - startedRef.current) / 1000)
    }
    recRef.current = rec
    startedRef.current = Date.now()
    rec.start(); setRecording(true); setSecs(0)
    timerRef.current = setInterval(() => setSecs((s) => { const n = s + 1; if (n >= 60) stop(); return n }), 1000)
  }

  return (
    <div className="vnote-rec">
      <div>
        <div className="ring"><video ref={videoRef} muted playsInline /></div>
        <div className="vnote-timer">
          {recording ? `🔴 ${secs}s / 60s` : 'Look at the camera and tap record 💫'}
        </div>
        <div className="vnote-controls">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {recording
            ? <button className="rec-btn" onClick={stop} title="Stop &amp; send">■</button>
            : <button className="rec-btn" onClick={start} title="Record">●</button>}
        </div>
      </div>
    </div>
  )
}
