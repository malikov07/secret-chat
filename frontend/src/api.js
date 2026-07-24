// Lightweight API client with JWT storage + auto-refresh.
const ACCESS = 'sc_access'
const REFRESH = 'sc_refresh'

export const tokens = {
  get access() { return localStorage.getItem(ACCESS) },
  get refresh() { return localStorage.getItem(REFRESH) },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS, access)
    if (refresh) localStorage.setItem(REFRESH, refresh)
  },
  clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH) },
}

async function toError(res) {
  let detail = `Request failed (${res.status})`
  try {
    const data = await res.json()
    detail = data.detail || Object.values(data)?.[0]?.[0] || JSON.stringify(data)
  } catch { /* ignore */ }
  const err = new Error(detail)
  err.status = res.status
  return err
}

async function tryRefresh() {
  if (!tokens.refresh) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh }),
  })
  if (!res.ok) { tokens.clear(); return false }
  const data = await res.json()
  tokens.set({ access: data.access, refresh: data.refresh })
  return true
}

async function request(path, { method = 'GET', body, auth = true, form = false } = {}) {
  const build = () => {
    const headers = {}
    if (!form && body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && tokens.access) headers['Authorization'] = `Bearer ${tokens.access}`
    return {
      method, headers,
      body: form ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    }
  }
  let res = await fetch(`/api${path}`, build())
  if (res.status === 401 && auth && await tryRefresh()) {
    res = await fetch(`/api${path}`, build())
  }
  if (!res.ok) throw await toError(res)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : null
}

export const api = {
  get: (p) => request(p),
  post: (p, body, opts) => request(p, { method: 'POST', body, ...opts }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  postForm: (p, formData) => request(p, { method: 'POST', body: formData, form: true }),
  patchForm: (p, formData) => request(p, { method: 'PATCH', body: formData, form: true }),
}
