import { useState, useRef, useEffect } from 'react'
import { CatGlyph } from './CatGlyph'
import { Icon } from './Icon'
import { catMeta } from '../../types'

interface Props {
  /** categoria selezionata; '' = tutte */
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  /** etichetta per l'opzione "nessun filtro" */
  allLabel?: string
}

/** Dropdown categorie con glyph + colori (le <option> native non supportano markup). */
export function CategorySelect({ value, options, onChange, allLabel = 'Tutte le categorie' }: Props) {
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

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const color = value ? catMeta(value).color : undefined

  return (
    <div className="catsel" ref={ref}>
      <button
        type="button"
        className={'catsel-trigger' + (value ? ' on' : '')}
        style={value ? { borderColor: color, backgroundColor: `${color}54` } : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtra per categoria"
      >
        {value ? (
          <>
            <CatGlyph category={value} size={20} />
            <span className="catsel-label" style={{ color }}>{value}</span>
          </>
        ) : (
          <span className="catsel-label catsel-placeholder">{allLabel}</span>
        )}
        <Icon
          name="chevDown"
          size={14}
          stroke={2}
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: '.16s', color: 'var(--text-3)' }}
        />
      </button>

      {open && (
        <div className="catsel-menu">
          <button
            type="button"
            className={'catsel-item' + (value === '' ? ' sel' : '')}
            onClick={() => select('')}
          >
            <span className="catsel-alldot" />
            <span>{allLabel}</span>
          </button>
          {options.map((c) => (
            <button
              type="button"
              key={c}
              className={'catsel-item' + (value === c ? ' sel' : '')}
              onClick={() => select(c)}
            >
              <CatGlyph category={c} size={24} />
              <span style={{ color: catMeta(c).color, fontWeight: 600 }}>{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
