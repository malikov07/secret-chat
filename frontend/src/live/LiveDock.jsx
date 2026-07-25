import { useEffect, useRef, useState } from 'react'
import { useLive } from './LiveProvider'
import MapPanel from './MapPanel'
import Avatar from '../components/Avatar'

export default function LiveDock() {
  const { viewer, remoteStream, loc, endSession } = useLive()
  const videoRef = useRef(null)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
      videoRef.current.play?.().catch(() => {})
    }
  }, [remoteStream])

  if (!viewer) return null
  const watch = viewer.kind === 'watch'
  return (
    <div className={`live-dock ${minimized ? 'min' : ''}`}>
      <div className="dock-head">
        <Avatar user={viewer.target} size={36} />
        <div className="grow">
          <b>{viewer.target.name}</b>
          <div className="dock-badge"><span className="rec" />{watch ? 'live camera & mic' : 'live location'}</div>
        </div>
        <button className="icon-btn dock-min" onClick={() => setMinimized(true)} title="Minimize">▁</button>
        <button className="btn btn-danger dock-end" onClick={() => endSession(viewer.id)}>End</button>
      </div>
      <div className="dock-body">
        {watch
          ? (remoteStream
              ? <video ref={videoRef} className="watch-video" autoPlay playsInline />
              : <div className="watch-wait"><span className="spinner" /><div>Connecting to {viewer.target.name}…</div></div>)
          : <MapPanel loc={loc} />}
        {minimized && (
          <div className="pip-controls">
            <button onClick={() => setMinimized(false)} title="Expand">⤢</button>
            <button className="pip-end" onClick={() => endSession(viewer.id)} title="End">✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
