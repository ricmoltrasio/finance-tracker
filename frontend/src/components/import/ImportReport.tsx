import { CheckCircle2, AlertCircle, SkipForward, Tag } from 'lucide-react'
import type { ImportResult } from '../../api/import'
import { Button } from '../common/Button'

interface Props {
  result: ImportResult
  onReset: () => void
}

export function ImportReport({ result, onReset }: Props) {
  const stats = [
    {
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      label: 'Importate',
      value: result.imported,
    },
    {
      icon: SkipForward,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      label: 'Duplicate saltate',
      value: result.skipped_duplicates,
    },
    {
      icon: Tag,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      label: 'Non categorizzate',
      value: result.uncategorized,
    },
    {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      label: 'Errori',
      value: result.errors,
    },
  ]

  return (
    <div className="space-y-5 text-center">
      <div>
        <CheckCircle2 size={48} className="mx-auto text-green-500 mb-2" />
        <h2 className="text-lg font-semibold text-gray-900">Importazione completata</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ icon: Icon, color, bg, label, value }) => (
          <div key={label} className={`rounded-xl p-4 ${bg}`}>
            <Icon size={20} className={`mx-auto mb-1 ${color}`} />
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {result.uncategorized > 0 && (
        <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {result.uncategorized} transazioni sono finite in "Altro" — puoi correggerle manualmente
          nella pagina Transazioni.
        </p>
      )}

      <Button variant="secondary" onClick={onReset} className="w-full">
        Importa un altro file
      </Button>
    </div>
  )
}
