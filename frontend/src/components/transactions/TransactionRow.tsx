import type { Transaction } from '../../types'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../types'
import { Badge } from '../common/Badge'
import { formatCurrency, formatDate } from '../../utils/format'

interface Props {
  transaction: Transaction
  onClick: (t: Transaction) => void
}

export function TransactionRow({ transaction: t, onClick }: Props) {
  const color = CATEGORY_COLORS[t.category] ?? '#64748B'
  const icon = CATEGORY_ICONS[t.category] ?? '🏷️'
  const isIncome = t.amount > 0

  return (
    <div
      onClick={() => onClick(t)}
      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${color}18` }}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{t.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{formatDate(t.date)}</span>
          <Badge color={color}>{t.category}</Badge>
          {t.source === 'manuale' && (
            <span className="text-xs text-gray-400">manuale</span>
          )}
        </div>
      </div>

      <span
        className={`shrink-0 text-sm font-semibold ${
          isIncome ? 'text-green-600' : 'text-gray-900'
        }`}
      >
        {isIncome ? '+' : ''}{formatCurrency(t.amount)}
      </span>
    </div>
  )
}
