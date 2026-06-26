import { useEffect } from 'react'

interface Props {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ message, confirmLabel = 'Elimina', onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="drawer-scrim" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line-2)',
          borderRadius: 18,
          padding: '24px 24px 20px',
          width: 'min(340px, 90vw)',
          margin: 'auto',
          marginTop: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.5, marginBottom: 20 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-soft" onClick={onCancel}>Annulla</button>
          <button
            className="btn-soft"
            style={{ color: 'var(--out)', borderColor: 'var(--out)', background: 'color-mix(in srgb, var(--out) 10%, transparent)' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
