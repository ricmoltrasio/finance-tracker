import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TimelinePoint } from '../../types'
import { formatCurrency, formatShortDate, formatMonth } from '../../utils/format'

interface Props {
  data: TimelinePoint[]
  granularity?: 'day' | 'month'
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-lg text-sm">
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function BalanceChart({ data, granularity = 'day' }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        Nessun dato disponibile
      </div>
    )
  }

  const formatter = granularity === 'month' ? formatMonth : formatShortDate

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tickFormatter={formatter}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="saldo_cumulativo"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#4f46e5' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
