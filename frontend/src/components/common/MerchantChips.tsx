import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Barra chip degli esercenti selezionati (filtro parziali per luogo di spesa).
 *  Non renderizza nulla se la selezione è vuota. `extra` è contenuto opzionale
 *  allineato a destra (es. la riga parziale in Transazioni). */
export function MerchantChips({
  merchants,
  onRemove,
  onClear,
  extra,
}: {
  merchants: string[]
  onRemove: (description: string) => void
  onClear: () => void
  extra?: ReactNode
}) {
  if (!merchants.length) return null
  return (
    <div className="mchips">
      {merchants.map((d) => (
        <button
          key={d}
          type="button"
          className="mchip"
          title={`Rimuovi "${d}" dal filtro`}
          onClick={() => onRemove(d)}
        >
          <span className="mchip-txt">{d}</span>
          <Icon name="close" size={11} stroke={2.4} style={{ flex: '0 0 auto' }} />
        </button>
      ))}
      <button type="button" className="mchip clear" onClick={onClear}>
        Azzera
      </button>
      {extra}
    </div>
  )
}
