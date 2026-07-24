export default function Modal({ children, onClose, className = '' }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className={`modal ${className}`}>{children}</div>
    </div>
  )
}
