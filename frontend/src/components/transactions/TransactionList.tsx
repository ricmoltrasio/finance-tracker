import type { Transaction } from '../../types'
import { TransactionRow } from './TransactionRow'
import { TxRowsSkeleton } from '../skeletons/TxRowsSkeleton'

interface Props {
  transactions: Transaction[]
  loading?: boolean
  onSelect: (t: Transaction) => void
  /** Se presenti, abilitano il gesto di selezione esercente sulle righe */
  onToggleMerchant?: (description: string) => void
  selectedMerchants?: string[]
}

export function TransactionList({ transactions, loading, onSelect, onToggleMerchant, selectedMerchants }: Props) {
  if (loading) {
    return <TxRowsSkeleton rows={8} />
  }

  if (!transactions.length) {
    return <div className="empty">Nessuna transazione trovata</div>
  }

  return (
    <div className="txlist d-comoda">
      {transactions.map((t) => (
        <TransactionRow
          key={t.id}
          transaction={t}
          onClick={onSelect}
          onToggleMerchant={onToggleMerchant}
          merchantSelected={selectedMerchants?.includes(t.description)}
        />
      ))}
    </div>
  )
}
