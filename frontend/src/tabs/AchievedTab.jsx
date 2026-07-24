import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { DreamCard, DreamDetail, DreamForm, AchievementForm } from './dreamsShared'

export default function AchievedTab() {
  const [dreams, setDreams] = useState([])
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editingAch, setEditingAch] = useState(null)

  const load = useCallback(async () => {
    try { setDreams(await api.get('/dreams')) } catch { /* ignore */ }
  }, [])
  useEffect(() => { load() }, [load])

  const achieved = dreams.filter((d) => d.is_achieved)

  return (
    <div className="pad">
      <div className="section-head"><h1>🏆 Achieved dreams</h1><div className="grow" /></div>

      {achieved.length === 0 && <div className="empty">Nothing here yet. Make a dream come true, then mark it 🏆</div>}
      <div className="dreams-grid">
        {achieved.map((d) => <DreamCard key={d.id} dream={d} onClick={() => setDetail(d)} />)}
      </div>

      {detail && (
        <DreamDetail dream={detail} onClose={() => setDetail(null)}
                     onEdit={() => { setEditingAch(detail); setDetail(null) }}
                     onDelete={async () => { await api.del(`/dreams/${detail.id}`); setDetail(null); load() }} />
      )}
      {editing && <DreamForm dream={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {editingAch && <AchievementForm dream={editingAch} onClose={() => setEditingAch(null)} onSaved={() => { setEditingAch(null); load() }} />}
    </div>
  )
}
