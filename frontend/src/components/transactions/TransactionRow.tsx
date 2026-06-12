import type { Transaction } from '../../types'
import { catMeta } from '../../types'
import { CatGlyph } from '../common/CatGlyph'
import { formatEUR } from '../../utils/format'

interface Props {
  transaction: Transaction
  onClick: (t: Transaction) => void
}

export function TransactionRow({ transaction: t, onClick }: Props) {
  const { color } = catMeta(t.category)
  const inc = t.amount > 0
  const d = new Date(t.date + 'T12:00:00')

  return (
    <button className="txrow" onClick={() => onClick(t)}>
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
