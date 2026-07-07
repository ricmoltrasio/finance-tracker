import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'

function isoToText(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** 'gg/mm/aaaa' → 'YYYY-MM-DD', o null se incompleta/invalida. */
function textToIso(t: string): string | null {
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  const valid =
    dt.getFullYear() === Number(y) &&
    dt.getMonth() === Number(mo) - 1 &&
    dt.getDate() === Number(d)
  return valid ? `${y}-${mo}-${d}` : null
}

/** Campo data con formato garantito gg/mm/aaaa.
 *
 *  Il formato visuale dell'input type="date" nativo segue la lingua del
 *  browser e non è controllabile: qui si usa un input testuale con maschera
 *  (solo cifre, slash automatici) + il calendario nativo aperto via
 *  showPicker() su un input date invisibile. */
export function DateField({
  value,
  onChange,
  small = false,
  style,
}: {
  value: string
  onChange: (v: string) => void
  /** true = variante compatta .field-sm (barra filtri desktop Transazioni) */
  small?: boolean
  style?: CSSProperties
}) {
  const [text, setText] = useState(() => isoToText(value))
  const [lastValue, setLastValue] = useState(value)
  const nativeRef = useRef<HTMLInputElement>(null)

  // riallinea il testo quando il valore cambia dall'esterno (scelta dal
  // calendario, cambio pill/mese, reset filtri): aggiustamento di stato
  // durante il render, senza effect
  if (value !== lastValue) {
    setLastValue(value)
    setText(isoToText(value))
  }

  const handleText = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    let t = digits
    if (digits.length > 4) t = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    else if (digits.length > 2) t = `${digits.slice(0, 2)}/${digits.slice(2)}`
    setText(t)
    const iso = textToIso(t)
    if (iso) onChange(iso)
  }

  const handleBlur = () => {
    if (!text.trim()) {
      if (value) onChange('')
      return
    }
    // testo incompleto o data inesistente → torna all'ultimo valore valido
    if (!textToIso(text)) setText(isoToText(value))
  }

  const openPicker = () => {
    const el = nativeRef.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      // browser senza showPicker(): resta l'inserimento da tastiera
    }
  }

  return (
    <span className={'datefield' + (small ? ' sm' : '')} style={style}>
      <input
        className={small ? 'field field-sm' : 'field'}
        type="text"
        inputMode="numeric"
        placeholder="gg/mm/aaaa"
        value={text}
        onChange={(e) => handleText(e.target.value)}
        onBlur={handleBlur}
        style={{ width: '100%' }}
      />
      <button
        type="button"
        className="datefield-btn"
        aria-label="Apri calendario"
        onClick={openPicker}
      >
        <Icon name="calendar" size={small ? 13 : 15} stroke={1.8} />
      </button>
      <input
        ref={nativeRef}
        className="datefield-native"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => { if (e.target.value) onChange(e.target.value) }}
      />
    </span>
  )
}
