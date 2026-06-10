import { useState } from 'react'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useSummary } from '../hooks/useSummary'
import { useTimeline } from '../hooks/useTimeline'
import { Card } from '../components/common/Card'
import { BalanceChart } from '../components/charts/BalanceChart'
import { Spinner } from '../components/common/Spinner'
import { Badge } from '../components/common/Badge'
import { formatCurrency, today, startOfMonth, startOfYear } from '../utils/format'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../types'

type PeriodKey = 'month' | 'quarter' | 'year' | 'ytd'

const PERIODS: { key: PeriodKey; label: string; granularity: 'day' | 'month' }[] = [
  { key: 'month', label: 'Questo mese', granularity: 'day' },
  { key: 'quarter', label: 'Ultimi 3 mesi', granularity: 'day' },
  { key: 'year', label: 'Ultimi 12 mesi', granularity: 'month' },
  { key: 'ytd', label: "Quest'anno", granularity: 'month' },
]

function getPeriod(key: PeriodKey): { from: string; to: string } {
  const t = today()
  if (key === 'month') return { from: startOfMonth(), to: t }
  if (key === 'quarter') return { from: startOfMonth(-3), to: t }
  if (key === 'year') return { from: startOfMonth(-12), to: t }
  return { from: startOfYear(), to: t }
}

export default function Overview() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const { from, to } = getPeriod(period)
  const gran = PERIODS.find((p) => p.key === period)?.granularity ?? 'day'

  const { data: summary, isLoading: loadingSummary } = useSummary(from, to)
  const { data: timeline, isLoading: loadingTimeline } = useTimeline(from, to, gran)

  const endBalance = timeline?.data?.at(-1)?.saldo_cumulativo

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      {loadingSummary ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <TrendingDown size={18} className="mx-auto mb-1 text-red-400" />
            <p className="text-xs text-gray-500">Spese</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {formatCurrency(summary?.spese_totali ?? 0)}
            </p>
          </Card>
          <Card className="text-center">
            <TrendingUp size={18} className="mx-auto mb-1 text-green-500" />
            <p className="text-xs text-gray-500">Entrate</p>
            <p className="text-base font-bold text-green-600 mt-0.5">
              {formatCurrency(summary?.entrate_totali ?? 0)}
            </p>
          </Card>
          <Card className="text-center">
            <Wallet size={18} className="mx-auto mb-1 text-indigo-400" />
            <p className="text-xs text-gray-500">Saldo</p>
            <p
              className={`text-base font-bold mt-0.5 ${
                (endBalance ?? 0) >= 0 ? 'text-indigo-600' : 'text-red-600'
              }`}
            >
              {endBalance !== undefined ? formatCurrency(endBalance) : '—'}
            </p>
          </Card>
        </div>
      )}

      {/* Timeline chart */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Andamento saldo</h2>
        {loadingTimeline ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <BalanceChart data={timeline?.data ?? []} granularity={gran} />
        )}
      </Card>

      {/* Category breakdown */}
      {!loadingSummary && summary && summary.per_categoria.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Spese per categoria</h2>
          <div className="space-y-2">
            {summary.per_categoria
              .filter((c) => c.spese > 0)
              .slice(0, 8)
              .map((c) => {
                const color = CATEGORY_COLORS[c.category] ?? '#64748B'
                const icon = CATEGORY_ICONS[c.category] ?? '🏷️'
                const pct =
                  summary.spese_totali > 0
                    ? Math.round((c.spese / summary.spese_totali) * 100)
                    : 0
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-700 font-medium">{c.category}</span>
                        <span className="text-gray-500">{formatCurrency(c.spese)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                    <Badge color={color}>{pct}%</Badge>
                  </div>
                )
              })}
          </div>
        </Card>
      )}
    </div>
  )
}
