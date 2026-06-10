import type { Transaction } from '../../types'
import { TransactionRow } from './TransactionRow'
import { Spinner } from '../common/Spinner'

interface Props {
  transactions: Transaction[]
  loading?: boolean
  onSelect: (t: Transaction) => void
}

export function TransactionList({ transactions, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (!transactions.length) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Nessuna transazione trovata
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {transactions.map((t) => (
        <TransactionRow key={t.id} transaction={t} onClick={onSelect} />
      ))}
    </div>
  )
}
