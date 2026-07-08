import type { Transaction } from '../../types'
import { catMeta } from '../../types'
import { CatGlyph } from '../common/CatGlyph'
import { formatEUR } from '../../utils/format'
import { useMerchantGesture } from '../../hooks/useMerchantGesture'

interface Props {
  transaction: Transaction
  onClick: (t: Transaction) => void
  /** Se presente, abilita il gesto di selezione esercente: doppio click su
   *  desktop, pressione prolungata su mobile (toggle sulla descrizione). */
  onToggleMerchant?: (description: string) => void
  /** true = esercente attualmente nel filtro (riga evidenziata) */
  merchantSelected?: boolean
}

export function TransactionRow({ transaction: t, onClick, onToggleMerchant, merchantSelected }: Props) {
  const { color } = catMeta(t.category)
  const inc = t.amount > 0
  const d = new Date(t.date + 'T12:00:00')

  const gesture = useMerchantGesture(
    () => onClick(t),
    onToggleMerchant ? () => onToggleMerchant(t.description) : undefined
  )

  return (
    <button className={'txrow' + (merchantSelected ? ' merchant-on' : '')} {...gesture}>
      <CatGlyph category={t.category} size={34} />
      <div className="txrow-main">
        <span className="txrow-desc">{t.description}</span>
        <span className="txrow-sub">
          <span className="txrow-cat" style={{ color }}>
            {t.category}
          </span>
          <span className="dot">·</span>
          {t.source === 'manuale' ? 'Manuale' : 'Import'}
          {t.is_split && (
            <>
              <span className="dot">·</span>
              <span style={{ color: 'var(--accent)' }}>Divisa</span>
            </>
          )}
          {t.city && (
            <>
              <span className="dot">·</span>
              <span className="txrow-city">📍 {t.city}</span>
            </>
          )}
        </span>
      </div>
      <div className="txrow-right">
        <span className={'txrow-amt ' + (inc ? 'in' : 'out')}>
          {formatEUR(t.amount, { plus: inc })}
        </span>
        <span className="txrow-date">
          {d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')}
        </span>
      </div>
    </button>
  )
}
