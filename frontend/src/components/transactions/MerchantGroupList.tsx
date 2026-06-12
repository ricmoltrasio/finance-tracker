import { useState, useMemo } from 'react'
import type { Transaction } from '../../types'
import { catMeta } from '../../types'
import { CatGlyph } from '../common/CatGlyph'
import { Icon } from '../common/Icon'
import { Spinner } from '../common/Spinner'
import { TransactionRow } from './TransactionRow'
import { formatEUR } from '../../utils/format'

interface Group {
  description: string
  category: string
  txs: Transaction[]
  total: number
}

interface Props {
  transactions: Transaction[]
  loading?: boolean
  onSelect: (t: Transaction) => void
}

/** Vista "raggruppa esercenti": le transazioni filtrate vengono raggruppate per
 *  descrizione (esercente), con numero di movimenti e totale speso; ogni riga è
 *  un accordion che mostra le sue transazioni. */
export function MerchantGroupList({ transactions, loading, onSelect }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const t of transactions) {
      const g = map.get(t.description) ?? {
        description: t.description,
        category: t.category,
        txs: [],
        total: 0,
      }
      g.txs.push(t)
      g.total += Math.abs(t.amount)
      map.set(t.description, g)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [transactions])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (!groups.length) {
    return <div className="empty">Nessuna transazione trovata</div>
  }

  const toggle = (d: string) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(d) ? n.delete(d) : n.add(d)
      return n
    })

  return (
    <div className="mgroup-list">
      {groups.map((g) => {
        const isOpen = open.has(g.description)
        const { color } = catMeta(g.category)
        return (
          <div key={g.description} className="mgroup">
            <button className="mgroup-head" onClick={() => toggle(g.description)}>
              <Icon
                name="chevRight"
                size={15}
                stroke={2}
                style={{ color: 'var(--text-3)', flex: '0 0 auto', transform: isOpen ? 'rotate(90deg)' : 'none', transition: '.16s' }}
              />
              <CatGlyph category={g.category} size={32} />
              <span className="mgroup-name">{g.description}</span>
              <span className="mgroup-n">{g.txs.length} mov.</span>
              <span className="mgroup-total" style={{ color }}>
                {formatEUR(g.total)}
              </span>
            </button>
            {isOpen && (
              <div className="mgroup-body">
                {g.txs.map((t) => (
                  <TransactionRow key={t.id} transaction={t} onClick={onSelect} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
