import { useState } from 'react'
import { useAuth } from '../auth'

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // login | register
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      if (mode === 'login') await login(phone.trim(), password)
      else await register(phone.trim(), password, name.trim())
    } catch (e2) {
      setErr(e2.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">💌</div>
        <div className="auth-title">Secret</div>
        <div className="auth-sub">
          {mode === 'login' ? 'A private space for two hearts' : 'Create your private space'}
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <input className="field" placeholder="Your name (optional)"
                   value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="field" placeholder="Phone number" inputMode="tel"
                 value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <input className="field" type="password" placeholder="Password"
                 value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <div className="auth-error">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? <span className="spinner" /> : (mode === 'login' ? 'Log in' : 'Create account')}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? "New here? " : 'Already have an account? '}
          <b onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
            {mode === 'login' ? 'Register' : 'Log in'}
          </b>
        </div>
      </div>
    </div>
  )
}
