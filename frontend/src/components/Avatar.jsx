export default function Avatar({ user, size = 44, showDot = false }) {
  const initial = (user?.display_name || user?.phone || '?').trim().charAt(0).toUpperCase()
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {user?.avatar ? <img src={user.avatar} alt="" /> : initial}
      </div>
      {showDot && user?.is_online && (
        <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0 }} />
      )}
    </div>
  )
}
