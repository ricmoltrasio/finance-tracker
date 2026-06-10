import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Trash2, Scissors } from 'lucide-react'
import type { Transaction, TransactionCreate } from '../../types'
import { CATEGORIES, CATEGORY_ICONS } from '../../types'
import { Button } from '../common/Button'
import { Input, Select } from '../common/Input'
import { formatCurrency, formatDate } from '../../utils/format'
import { useUpdateTransaction, useDeleteTransaction, useCreateTransaction } from '../../hooks/useTransactions'
import { useToast } from '../../context/ToastContext'
import { SplitForm } from './SplitForm'

// ── Edit drawer ────────────────────────────────────────────────────────────────

interface EditProps {
  transaction: Transaction
  onClose: () => void
}

export function EditDrawer({ transaction: t, onClose }: EditProps) {
  const { register, handleSubmit } = useForm({
    defaultValues: { category: t.category, note: t.note ?? '' },
  })
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const { toast } = useToast()
  const [showSplit, setShowSplit] = useState(false)

  const onSave = handleSubmit(async (data) => {
    await update.mutateAsync({ id: t.id, body: data })
    toast('Transazione aggiornata', 'success')
    onClose()
  })

  const onDelete = async () => {
    if (!confirm('Eliminare questa transazione?')) return
    await del.mutateAsync(t.id)
    toast('Transazione eliminata', 'success')
    onClose()
  }

  const isIncome = t.amount > 0

  return (
    <DrawerShell onClose={onClose} title={showSplit ? 'Dividi transazione' : 'Dettaglio transazione'}>
      {showSplit ? (
        <div className="space-y-3">
          <button onClick={() => setShowSplit(false)} className="text-sm text-indigo-600 hover:underline">
            ← Torna al dettaglio
          </button>
          <SplitForm transaction={t} onClose={onClose} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 space-y-1">
            <p className="text-sm text-gray-500">{formatDate(t.date)}</p>
            <p className="font-medium text-gray-900">{t.description}</p>
            <p className={`text-lg font-bold ${isIncome ? 'text-green-600' : 'text-gray-900'}`}>
              {isIncome ? '+' : ''}{formatCurrency(t.amount)}
            </p>
            {t.is_split && (
              <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                Divisa
              </span>
            )}
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <Select label="Categoria" {...register('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_ICONS[c]} {c}
                </option>
              ))}
            </Select>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Note</label>
              <textarea
                {...register('note')}
                rows={2}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={update.isPending}>
                {update.isPending ? 'Salvataggio…' : 'Salva'}
              </Button>
              {!t.is_split && (
                <Button type="button" variant="secondary" onClick={() => setShowSplit(true)}>
                  <Scissors size={15} />
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                onClick={onDelete}
                disabled={del.isPending}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </form>
        </div>
      )}
    </DrawerShell>
  )
}

// ── Create drawer ──────────────────────────────────────────────────────────────

interface CreateProps {
  onClose: () => void
}

type CreateForm = {
  date: string
  description: string
  amount: string
  isIncome: boolean
  category: string
  note: string
}

export function CreateDrawer({ onClose }: CreateProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateForm>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      isIncome: false,
      category: 'Cibo',
    },
  })
  const create = useCreateTransaction()
  const { toast } = useToast()
  const isIncome = watch('isIncome')

  // Auto-switch to income categories when toggled
  useEffect(() => {
    setValue('category', isIncome ? 'Stipendio' : 'Cibo')
  }, [isIncome, setValue])

  const onSubmit = handleSubmit(async (data) => {
    const rawAmount = parseFloat(data.amount.replace(',', '.'))
    const amount = isIncome ? Math.abs(rawAmount) : -Math.abs(rawAmount)

    const body: TransactionCreate = {
      date: data.date,
      description: data.description,
      amount,
      category: data.category,
      source: 'manuale',
      note: data.note,
    }
    await create.mutateAsync(body)
    toast('Transazione aggiunta', 'success')
    onClose()
  })

  const incomeCategories = CATEGORIES.filter((c) => ['Stipendio', 'Contanti', 'Rimborsi'].includes(c))
  const expenseCategories = CATEGORIES.filter((c) => !['Stipendio', 'Contanti', 'Rimborsi'].includes(c))
  const categoryList = isIncome ? incomeCategories : expenseCategories

  return (
    <DrawerShell onClose={onClose} title="Nuova transazione">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setValue('isIncome', false)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              !isIncome ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Uscita
          </button>
          <button
            type="button"
            onClick={() => setValue('isIncome', true)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              isIncome ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Entrata
          </button>
        </div>

        <Input
          label="Data"
          type="date"
          {...register('date', { required: true })}
          error={errors.date ? 'Campo obbligatorio' : undefined}
        />
        <Input
          label="Descrizione"
          type="text"
          placeholder="es. Esselunga"
          {...register('description', { required: true })}
          error={errors.description ? 'Campo obbligatorio' : undefined}
        />
        <Input
          label="Importo (€)"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          {...register('amount', { required: true })}
          error={errors.amount ? 'Campo obbligatorio' : undefined}
        />
        <Select label="Categoria" {...register('category')}>
          {categoryList.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_ICONS[c]} {c}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Note (opzionale)</label>
          <textarea
            {...register('note')}
            rows={2}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <Button type="submit" className="w-full" disabled={create.isPending}>
          {create.isPending ? 'Salvataggio…' : 'Aggiungi'}
        </Button>
      </form>
    </DrawerShell>
  )
}

// ── Shared shell ───────────────────────────────────────────────────────────────

function DrawerShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex w-full max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
