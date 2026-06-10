import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Transaction } from '../../types'
import { CATEGORIES, CATEGORY_ICONS } from '../../types'
import { transactionsApi } from '../../api/transactions'
import { Button } from '../common/Button'
import { Select } from '../common/Input'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../context/ToastContext'

interface SplitItem {
  category: string
  amount: string
  note: string
}

interface Props {
  transaction: Transaction
  onClose: () => void
}

export function SplitForm({ transaction, onClose }: Props) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const total = transaction.amount

  const [items, setItems] = useState<SplitItem[]>([
    { category: 'Cibo', amount: '', note: '' },
    { category: 'Altro', amount: '', note: '' },
  ])

  const splitMutation = useMutation({
    mutationFn: (body: { items: { category: string; amount: number; note: string }[] }) =>
      transactionsApi.split(transaction.id, body.items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast('Split creato', 'success')
      onClose()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateItem = (i: number, field: keyof SplitItem, value: string) =>
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))

  const addItem = () =>
    setItems((prev) => [...prev, { category: 'Altro', amount: '', note: '' }])

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i))

  const parsedAmounts = items.map((it) => parseFloat(it.amount.replace(',', '.')) || 0)
  const sumParsed = parsedAmounts.reduce((a, b) => a + b, 0)
  const diff = Math.abs(parseFloat((total - sumParsed).toFixed(2)))
  const isValid = items.length >= 2 && diff <= 0.01

  const handleSubmit = () => {
    splitMutation.mutate({
      items: items.map((it, i) => ({
        category: it.category,
        amount: parsedAmounts[i],
        note: it.note,
      })),
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 px-4 py-3 flex justify-between text-sm">
        <span className="text-gray-500">Totale originale</span>
        <span className="font-semibold">{formatCurrency(total)}</span>
      </div>

      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Parte {i + 1}</span>
            {items.length > 2 && (
              <button
                onClick={() => removeItem(i)}
                className="ml-auto text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={item.category}
              onChange={(e) => updateItem(i, 'category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </Select>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={item.amount}
              onChange={(e) => updateItem(i, 'amount', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Nota (opzionale)"
            value={item.note}
            onChange={(e) => updateItem(i, 'note', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      ))}

      <button
        onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
      >
        <Plus size={14} /> Aggiungi parte
      </button>

      <div className={`flex justify-between rounded-lg px-4 py-2 text-sm ${isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
        <span>Somma parti</span>
        <span className="font-semibold">
          {formatCurrency(sumParsed)}
          {!isValid && diff > 0 && ` (diff: €${diff.toFixed(2)})`}
        </span>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!isValid || splitMutation.isPending}
        className="w-full"
      >
        {splitMutation.isPending ? 'Salvataggio…' : 'Crea split'}
      </Button>
    </div>
  )
}
