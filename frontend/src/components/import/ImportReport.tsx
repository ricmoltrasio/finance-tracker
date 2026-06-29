import { useState } from 'react'
import type { ImportResult, ImportRow } from '../../api/import'
import { formatEUR } from '../../utils/format'
import { useIsMobile } from '../../hooks/useIsMobile'
import { MobileSheet } from '../common/MobileSheet'

type BucketKey = 'imported' | 'duplicates' | 'uncategorized'

interface Props {
  result: ImportResult
  onReset: () => void
}

const BUCKET_LABELS: Record<BucketKey, string> = {
  imported: 'Importate',
  duplicates: 'Duplicate saltate',
  uncategorized: 'Non categorizzate',
}

function TxRow({ tx }: { tx: ImportRow }) {
  const isOut = tx.amount < 0
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '88px 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '9px 12px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {tx.date}
      </span>
      <span
        style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={tx.description}
      >
        {tx.description}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        {tx.category && (
          <span
            style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 6,
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
            }}
          >
            {tx.category}
          </span>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            color: isOut ? 'var(--out)' : 'var(--in)',
          }}
        >
          {formatEUR(tx.amount, { plus: !isOut })}
        </span>
      </div>
    </div>
  )
}

function BucketList({ rows, label }: { rows: ImportRow[]; label: string }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 120,
          color: 'var(--text-3)',
          fontSize: 13,
        }}
      >
        Nessuna transazione in "{label}"
      </div>
    )
  }
  return (
    <div>
      {rows.map((tx, i) => (
        <TxRow key={tx.id ?? `${tx.date}-${i}`} tx={tx} />
      ))}
    </div>
  )
}

export function ImportReport({ result, onReset }: Props) {
  const isMobile = useIsMobile()

  const defaultBucket: BucketKey =
    result.rows.imported.length > 0 ? 'imported'
    : result.rows.duplicates.length > 0 ? 'duplicates'
    : 'uncategorized'

  const [active, setActive] = useState<BucketKey>(defaultBucket)
  const [sheetOpen, setSheetOpen] = useState(false)

  const stats: { key: BucketKey; color: string; value: number }[] = [
    { key: 'imported',      color: 'var(--in)',    value: result.imported           },
    { key: 'duplicates',    color: '#F2C14E',       value: result.skipped_duplicates },
    { key: 'uncategorized', color: 'var(--accent)', value: result.uncategorized      },
  ]

  const activeRows = result.rows[active]

  const handleCardClick = (key: BucketKey) => {
    setActive(key)
    if (isMobile) setSheetOpen(true)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '260px 1fr',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* ── colonna sinistra: riepilogo ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 10px',
              background: 'color-mix(in oklab, var(--in) 14%, transparent)',
              color: 'var(--in)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l5 5L20 6" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Importazione completata</p>
          {result.errors > 0 && (
            <p style={{ fontSize: 12, color: 'var(--out)', marginTop: 4 }}>{result.errors} errori</p>
          )}
        </div>

        {stats.map((s) => {
          const isActive = active === s.key && !isMobile
          return (
            <button
              key={s.key}
              onClick={() => handleCardClick(s.key)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                borderRadius: 12,
                padding: '14px 16px',
                background: isActive
                  ? 'color-mix(in oklab, var(--accent) 10%, var(--surface))'
                  : 'var(--surface)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--line)'}`,
                transition: 'border-color .15s, background .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{BUCKET_LABELS[s.key]}</span>
                {!isMobile && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-3)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                {s.value}
              </p>
            </button>
          )
        })}

        {result.uncategorized > 0 && (
          <p
            style={{
              borderRadius: 11,
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--accent)',
              background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
              border: '1px solid color-mix(in oklab, var(--accent) 25%, transparent)',
            }}
          >
            Le transazioni in "Altro" possono essere corrette dalla pagina Transazioni.
          </p>
        )}

        <button className="btn-soft" style={{ width: '100%', justifyContent: 'center' }} onClick={onReset}>
          Importa un altro file
        </button>
      </div>

      {/* ── colonna destra: lista (solo desktop) ── */}
      {!isMobile && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
              {BUCKET_LABELS[active]}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {activeRows.length} {activeRows.length === 1 ? 'transazione' : 'transazioni'}
            </span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            <BucketList rows={activeRows} label={BUCKET_LABELS[active]} />
          </div>
        </div>
      )}

      {/* ── sheet mobile ── */}
      {isMobile && sheetOpen && (
        <MobileSheet title={BUCKET_LABELS[active]} onClose={() => setSheetOpen(false)}>
          <BucketList rows={activeRows} label={BUCKET_LABELS[active]} />
        </MobileSheet>
      )}
    </div>
  )
}
