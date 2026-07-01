import { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'

export interface PeriodOption {
  key: string
  label: string
}

/** Selettore periodo.
 *  - Default: chip collassato con popover (usato nell'header su mobile).
 *  - `inline`: griglia di pill tutte visibili (usato dentro MobileSheet,
 *    dove il popover absolute verrebbe clippato dall'overflow del drawer). */
export function PeriodChip({
  options,
  value,
  onChange,
  inline = false,
}: {
  options: PeriodOption[]
  value: string
  onChange: (key: string) => void
  inline?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (inline) {
    return (
      <div className="period-pills">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={'period-pill' + (value === o.key ? ' on' : '')}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  const current = options.find((o) => o.key === value)?.label ?? '—'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="period-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current}
        <Icon
          name="chevDown"
          size={14}
          stroke={2}
          style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: '.16s' }}
        />
      </button>
      {open && (
        <div className="period-pop" role="listbox">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={value === o.key}
              className={value === o.key ? 'on' : ''}
              onClick={() => {
                onChange(o.key)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
