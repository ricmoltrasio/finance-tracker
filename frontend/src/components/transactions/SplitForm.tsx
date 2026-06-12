import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Transaction } from '../../types'
import { CATEGORIES } from '../../types'
import { Icon } from '../common/Icon'
import { transactionsApi } from '../../api/transactions'
import { formatEUR } from '../../utils/format'
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

  const addItem = () => setItems((prev) => [...prev, { category: 'Altro', amount: '', note: '' }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const parsedAmounts = items.map((it) => parseFloat(it.amount.replace(',', '.')) || 0)
  const sumParsed = parsedAmounts.reduce((a, b) => a + b, 0)
  const diff = Math.abs(parseFloat((Math.abs(total) - Math.abs(sumParsed)).toFixed(2)))
  const isValid = items.length >= 2 && diff <= 0.01

  const handleSubmit = () => {
    splitMutation.mutate({
      items: items.map((it, i) => ({
        category: it.category,
        amount: total < 0 ? -Math.abs(parsedAmounts[i]) : Math.abs(parsedAmounts[i]),
        note: it.note,
      })),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex justify-between"
        style={{
          background: 'var(--surface-2)',
          borderRadius: 11,
          padding: '11px 14px',
          fontSize: 13,
        }}
      >
        <span style={{ color: 'var(--text-3)' }}>Totale originale</span>
        <span style={{ fontWeight: 600 }}>{formatEUR(total)}</span>
      </div>

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            border: '1px solid var(--line)',
            padding: 12,
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center">
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)' }}>
              Parte {i + 1}
            </span>
            {items.length > 2 && (
              <button
                onClick={() => removeItem(i)}
                style={{ marginLeft: 'auto', color: 'var(--text-3)' }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="field"
              value={item.category}
              onChange={(e) => updateItem(i, 'category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="field"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={item.amount}
              onChange={(e) => updateItem(i, 'amount', e.target.value)}
            />
          </div>
          <input
            className="field"
            type="text"
            placeholder="Nota (opzionale)"
            value={item.note}
            onChange={(e) => updateItem(i, 'note', e.target.value)}
          />
        </div>
      ))}

      <button
        onClick={addItem}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          padding: '9px',
          borderRadius: 11,
          border: '1px dashed var(--line-2)',
          color: 'var(--text-3)',
          fontSize: 13,
        }}
      >
        <Icon name="plus" size={14} /> Aggiungi parte
      </button>

      <div
        className="flex justify-between"
        style={{
          borderRadius: 11,
          padding: '9px 14px',
          fontSize: 13,
          color: isValid ? 'var(--in)' : 'var(--out)',
          background: isValid
            ? 'color-mix(in oklab, var(--in) 12%, transparent)'
            : 'color-mix(in oklab, var(--out) 12%, transparent)',
        }}
      >
        <span>Somma parti</span>
        <span style={{ fontWeight: 600 }}>
          {formatEUR(sumParsed)}
          {!isValid && diff > 0 && ` (diff: ${diff.toFixed(2)} €)`}
        </span>
      </div>

      <button
        className="btn-accent"
        style={{ justifyContent: 'center', padding: 11 }}
        onClick={handleSubmit}
        disabled={!isValid || splitMutation.isPending}
      >
        {splitMutation.isPending ? 'Salvataggio…' : 'Crea split'}
      </button>
    </div>
  )
}
