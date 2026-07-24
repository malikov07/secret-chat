import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'

export default function PairScreen() {
  const { user, refreshUser, logout } = useAuth()
  const [phone, setPhone] = useState('')
  const [reqs, setReqs] = useState({ incoming: [], outgoing: [] })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setReqs(await api.get('/pair/requests')) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  const send = async (e) => {
    e.preventDefault()
    setMsg(''); setBusy(true)
    try {
      await api.post('/pair/requests', { phone: phone.trim() })
      setMsg('Invite sent 💌')
      setPhone('')
      load()
    } catch (e2) { setMsg(e2.message) } finally { setBusy(false) }
  }

  const respond = async (id, accept) => {
    try {
      await api.post(`/pair/requests/${id}/respond`, { accept })
      if (accept) await refreshUser()
      else load()
    } catch (e2) { setMsg(e2.message) }
  }

  return (
    <div className="center-wrap">
      <div className="center-card">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="auth-logo" style={{ width: 64, height: 64, fontSize: 30 }}>💞</div>
          <h2 style={{ marginTop: 12 }}>Connect with your person</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 6 }}>
            Your number: <b>{user.phone}</b>
          </p>
        </div>

        <form className="auth-form" onSubmit={send}>
          <input className="field" placeholder="Their phone number" inputMode="tel"
                 value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Send invite'}
          </button>
        </form>
        {msg && <p style={{ textAlign: 'center', color: 'var(--accent)', marginTop: 12, fontSize: 14 }}>{msg}</p>}

        {reqs.incoming.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="label">Invitations for you</div>
            {reqs.incoming.map((r) => (
              <div className="user-row" key={r.id}>
                <Avatar user={r.from_user} size={40} />
                <div className="grow"><b>{r.from_user.name}</b></div>
                <button className="btn btn-primary" onClick={() => respond(r.id, true)}>Accept</button>
                <button className="btn btn-ghost" onClick={() => respond(r.id, false)}>Decline</button>
              </div>
            ))}
          </div>
        )}
        {reqs.outgoing.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="label">Waiting for</div>
            {reqs.outgoing.map((r) => (
              <div className="chip" key={r.id} style={{ marginRight: 6 }}>{r.to_user.name} · pending</div>
            ))}
          </div>
        )}

        <button className="btn btn-ghost btn-block" style={{ marginTop: 24 }} onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  )
}
