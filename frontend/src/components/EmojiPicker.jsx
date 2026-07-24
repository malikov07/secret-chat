import { useState } from 'react'
import { EMOJI } from '../emoji'

export default function EmojiPicker({ onPick, onClose }) {
  const [cat, setCat] = useState(EMOJI[0].key)
  const active = EMOJI.find((c) => c.key === cat) || EMOJI[0]
  return (
    <div className="emoji-pop" onMouseLeave={onClose}>
      <div className="emoji-cats">
        {EMOJI.map((c) => (
          <button key={c.key} className={c.key === cat ? 'active' : ''}
                  onClick={() => setCat(c.key)} title={c.name}>{c.label}</button>
        ))}
      </div>
      <div className="emoji-grid">
        {active.emojis.map((e, i) => (
          <button key={i} onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </div>
  )
}
