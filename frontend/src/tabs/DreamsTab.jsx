import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { DreamCard, DreamDetail, DreamForm, AchievementForm } from './dreamsShared'

export default function DreamsTab() {
  const [dreams, setDreams] = useState([])
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [achieving, setAchieving] = useState(null)

  const load = useCallback(async () => {
    try { setDreams(await api.get('/dreams')) } catch { /* ignore */ }
  }, [])
  useEffect(() => { load() }, [load])

  const active = dreams.filter((d) => !d.is_achieved)

  return (
    <div className="pad">
      <div className="section-head">
        <h1>🌙 Dreams</h1><div className="grow" />
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ New dream</button>
      </div>

      {active.length === 0 && <div className="empty">No dreams yet. Write the first one you shared 💫</div>}
      <div className="dreams-grid">
        {active.map((d) => <DreamCard key={d.id} dream={d} onClick={() => setDetail(d)} />)}
      </div>

      {adding && <DreamForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
      {detail && (
        <DreamDetail dream={detail} onClose={() => setDetail(null)}
                     onEdit={() => { setEditing(detail); setDetail(null) }}
                     onDelete={async () => { await api.del(`/dreams/${detail.id}`); setDetail(null); load() }}
                     onAchieve={() => { setAchieving(detail); setDetail(null) }} />
      )}
      {editing && <DreamForm dream={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {achieving && <AchievementForm dream={achieving} onClose={() => setAchieving(null)} onSaved={() => { setAchieving(null); load() }} />}
    </div>
  )
}
