import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'

export default function AdminPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [users, setUsers] = useState([])
  const [err, setErr] = useState('')

  const load = () => api.get('/admin/users').then(setUsers).catch((e) => setErr(e.message))

  useEffect(() => {
    if (user.role !== 'admin') { nav('/'); return }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setRole = async (u, role) => {
    try { await api.post(`/admin/users/${u.id}/role`, { role }); load() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="pad">
      <div className="admin-wrap">
        <div className="section-head">
          <button className="icon-btn" onClick={() => nav('/')}>‹</button>
          <h1>⚙️ Admin</h1>
        </div>
        {err && <div className="auth-error">{err}</div>}
        <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
          Promote a user to <b>sub-admin</b> to let them request live camera/mic and location
          from their partner. Every request still needs the partner's explicit consent.
        </p>
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <Avatar user={u} size={42} showDot />
            <div className="grow">
              <b>{u.name}</b>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {u.phone} · <span className={`role-tag ${u.role}`}>{u.role}</span>
              </div>
            </div>
            {u.role === 'admin'
              ? <span className="chip">admin</span>
              : u.role === 'subadmin'
                ? <button className="btn btn-ghost" onClick={() => setRole(u, 'user')}>Demote</button>
                : <button className="btn btn-primary" onClick={() => setRole(u, 'subadmin')}>Make sub-admin</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
