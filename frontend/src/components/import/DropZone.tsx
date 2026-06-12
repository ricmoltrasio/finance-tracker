import { useRef, useState } from 'react'
import { Icon } from '../common/Icon'
import { Spinner } from '../common/Spinner'

interface Props {
  onFile: (file: File) => void
  loading?: boolean
  error?: string | null
}

export function DropZone({ onFile, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      alert('Formato non supportato. Usa CSV o Excel (.xlsx, .xls)')
      return
    }
    onFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handle(file)
      }}
      className={'dropzone' + (dragging ? ' drag' : '')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handle(file)
        }}
      />

      {loading ? (
        <>
          <Spinner className="mb-3" />
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Analisi del file in corso…</p>
        </>
      ) : (
        <>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
              marginBottom: 16,
            }}
          >
            <Icon name="upload" size={26} stroke={1.8} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            Trascina il file qui
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>
            CSV o Excel — Intesa SP, UniCredit, Fineco e altri
          </p>
          <button className="btn-accent" onClick={() => inputRef.current?.click()}>
            Sfoglia file
          </button>
        </>
      )}

      {error && (
        <p
          style={{
            marginTop: 14,
            borderRadius: 10,
            padding: '9px 13px',
            fontSize: 13,
            color: 'var(--out)',
            background: 'color-mix(in oklab, var(--out) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--out) 25%, transparent)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
