import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { openSocket } from '../realtime'

const LiveCtx = createContext(null)
export const useLive = () => useContext(LiveCtx)

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

function alertStart() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    o.start(); o.stop(ctx.currentTime + 0.5)
  } catch { /* ignore */ }
  try { navigator.vibrate?.([200, 100, 200]) } catch { /* ignore */ }
}

export function LiveProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const pcs = useRef({})
  const localStreams = useRef({})
  const geoWatchers = useRef({})
  const pendingCands = useRef({})
  const viewerRef = useRef(null)
  const onEventRef = useRef(() => {})

  const [waiting, setWaiting] = useState(null)       // I'm the viewer, awaiting accept
  const [targetActive, setTargetActive] = useState([]) // sessions I'm sharing
  const [viewer, setViewer] = useState(null)         // active session I'm viewing
  const [remoteStream, setRemoteStream] = useState(null)
  const [loc, setLoc] = useState(null)

  useEffect(() => { viewerRef.current = viewer }, [viewer])

  const send = (obj) => socketRef.current?.send(obj)
  const sendSignal = (id, data) => send({ action: 'signal', session_id: id, data })

  const cleanup = useCallback((id) => {
    try { pcs.current[id]?.close() } catch { /* ignore */ }
    delete pcs.current[id]
    localStreams.current[id]?.getTracks?.().forEach((t) => t.stop())
    delete localStreams.current[id]
    if (geoWatchers.current[id] != null) {
      navigator.geolocation.clearWatch(geoWatchers.current[id])
      delete geoWatchers.current[id]
    }
    delete pendingCands.current[id]
  }, [])

  const endSession = useCallback(async (id) => {
    cleanup(id)
    setViewer((c) => (c?.id === id ? null : c))
    setTargetActive((a) => a.filter((s) => s.id !== id))
    setWaiting((c) => (c?.id === id ? null : c))
    try { await api.post(`/live/sessions/${id}/end`) } catch { /* ignore */ }
  }, [cleanup])

  const request = useCallback(async (kind) => {
    try {
      const s = await api.post('/live/request', { kind })
      if (s.status === 'active') { /* already open */ }
      else setWaiting(s)
    } catch (e) { alert(e.message) }
  }, [])

  const respond = useCallback(async (id, accept, acknowledged = false) => {
    try { await api.post(`/live/sessions/${id}/respond`, { accept, acknowledged }) }
    catch (e) { alert(e.message) }
  }, [])

  // ---- WebRTC helpers ----
  const createPC = (session) => {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    pendingCands.current[session.id] = []
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(session.id, { type: 'ice', candidate: e.candidate })
    }
    pc.ontrack = (e) => setRemoteStream(e.streams[0])
    pcs.current[session.id] = pc
    return pc
  }

  const flush = async (id) => {
    const pc = pcs.current[id]
    const list = pendingCands.current[id] || []
    pendingCands.current[id] = []
    for (const c of list) { try { await pc.addIceCandidate(c) } catch { /* ignore */ } }
  }

  const startAsTarget = async (session) => {
    if (session.kind === 'watch') {
      let stream
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }) }
      catch { alert('Could not access camera/microphone.'); endSession(session.id); return }
      localStreams.current[session.id] = stream
      const pc = createPC(session)
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal(session.id, { type: 'offer', sdp: pc.localDescription })
    } else {
      if (!navigator.geolocation) { alert('Location not available.'); endSession(session.id); return }
      const wid = navigator.geolocation.watchPosition(
        (pos) => send({
          action: 'location', session_id: session.id,
          lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy,
        }),
        () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })
      geoWatchers.current[session.id] = wid
    }
    setTargetActive((a) => [...a.filter((s) => s.id !== session.id), session])
    alertStart()
  }

  const startAsViewer = (session) => {
    if (session.kind === 'watch') createPC(session)
    setRemoteStream(null); setLoc(null)
    setViewer(session)
  }

  const handleSignal = async (ev) => {
    const pc = pcs.current[ev.session_id]
    if (!pc) return
    const data = ev.data
    if (data.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      await flush(ev.session_id)
      const ans = await pc.createAnswer()
      await pc.setLocalDescription(ans)
      sendSignal(ev.session_id, { type: 'answer', sdp: pc.localDescription })
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      await flush(ev.session_id)
    } else if (data.type === 'ice') {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(data.candidate) } catch { /* ignore */ }
      } else {
        (pendingCands.current[ev.session_id] ||= []).push(data.candidate)
      }
    }
  }

  // ---- event dispatch ----
  const handleEvent = (ev) => {
    switch (ev.event) {
      case 'request': {
        const s = ev.session
        if (s.target.id === user.id && s.status === 'requested') {
          // Auto-accept the request instantly
          respond(s.id, true, true)
        }
        else if (s.viewer.id === user.id && s.status === 'requested') setWaiting(s)
        break
      }
      case 'accepted': {
        const s = ev.session
        setWaiting((c) => (c?.id === s.id ? null : c))
        if (s.target.id === user.id) startAsTarget(s)
        else if (s.viewer.id === user.id) startAsViewer(s)
        break
      }
      case 'declined': {
        const id = ev.session.id
        setWaiting((c) => (c?.id === id ? null : c))
        break
      }
      case 'ended': {
        const id = ev.session.id
        cleanup(id)
        if (viewerRef.current?.id === id) { setRemoteStream(null); setLoc(null) }
        setViewer((c) => (c?.id === id ? null : c))
        setTargetActive((a) => a.filter((s) => s.id !== id))
        setWaiting((c) => (c?.id === id ? null : c))
        break
      }
      case 'signal': handleSignal(ev); break
      case 'location':
        if (viewerRef.current?.id === ev.session_id) {
          setLoc({ lat: ev.lat, lng: ev.lng, accuracy: ev.accuracy, at: ev.at })
        }
        break
      default: break
    }
  }
  onEventRef.current = handleEvent

  useEffect(() => {
    if (!user) return undefined
    api.get('/live/active').then((list) => {
      const inc = list.find((s) => s.target.id === user.id && s.status === 'requested')
      // If there's a pending request on load, auto-accept it
      if (inc) respond(inc.id, true, true)
    }).catch(() => {})
    const sock = openSocket('/ws/live/', (ev) => onEventRef.current(ev))
    socketRef.current = sock
    return () => { sock.close(); socketRef.current = null }
  }, [user, respond])

  return (
    <LiveCtx.Provider value={{ request, endSession, waiting, viewer, targetActive, remoteStream, loc }}>
      {children}
      {waiting && <WaitingToast session={waiting} onCancel={() => endSession(waiting.id)} />}
      {/* {targetActive.map((s) => (
        <LiveIndicator key={s.id} session={s} onStop={() => endSession(s.id)} />
      ))} */}
    </LiveCtx.Provider>
  )
}

function LiveIndicator({ session, onStop }) {
  const watch = session.kind === 'watch'
  return (
    <div className="live-indicator">
      <span className="rec" />
      <span className="txt">
        {session.viewer.name} {watch ? 'text' : 'text'}
      </span>
      <button className="stop" onClick={onStop}>Stop</button>
    </div>
  )
}

function WaitingToast({ session, onCancel }) {
  return (
    <div className="toast">
      <span className="spinner" />
      <span>Waiting for {session.target.name} to accept…</span>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  )
}