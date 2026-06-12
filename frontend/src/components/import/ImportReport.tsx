import type { ImportResult } from '../../api/import'

interface Props {
  result: ImportResult
  onReset: () => void
}

export function ImportReport({ result, onReset }: Props) {
  const stats = [
    { color: 'var(--in)', label: 'Importate', value: result.imported },
    { color: '#F2C14E', label: 'Duplicate saltate', value: result.skipped_duplicates },
    { color: 'var(--accent)', label: 'Non categorizzate', value: result.uncategorized },
    { color: 'var(--out)', label: 'Errori', value: result.errors },
  ]

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 12px',
            background: 'color-mix(in oklab, var(--in) 14%, transparent)',
            color: 'var(--in)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
          Importazione completata
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ width: '100%' }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              borderRadius: 12,
              padding: 16,
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
            }}
          >
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {result.uncategorized > 0 && (
        <p
          style={{
            borderRadius: 11,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--accent)',
            background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--accent) 25%, transparent)',
          }}
        >
          {result.uncategorized} transazioni sono finite in "Altro" — puoi correggerle dalla pagina
          Transazioni.
        </p>
      )}

      <button className="btn-soft" style={{ width: '100%', justifyContent: 'center' }} onClick={onReset}>
        Importa un altro file
      </button>
    </div>
  )
}
