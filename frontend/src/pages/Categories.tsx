import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Spinner } from '../components/common/Spinner'
import { useCategories } from '../hooks/useCategories'
import { categoriesApi } from '../api/categories'
import { transactionsApi } from '../api/transactions'
import { useToast } from '../context/ToastContext'
import type { Category } from '../types'

function CategoryRow({ cat }: { cat: Category }) {
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState(cat.keywords.join(', '))
  const { toast } = useToast()
  const qc = useQueryClient()

  const update = useMutation({
    mutationFn: () =>
      categoriesApi.update(cat.id, {
        keywords: keywords
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Categoria aggiornata', 'success')
      setOpen(false)
    },
    onError: () => toast('Errore nel salvataggio', 'error'),
  })

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-xl w-7 text-center">{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900">{cat.name}</p>
          {!open && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {cat.keywords.length > 0 ? cat.keywords.join(', ') : 'Nessuna parola chiave'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
          <span className="text-gray-400">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Parole chiave (separate da virgola)
            </label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="es. esselunga, conad, lidl"
            />
            <p className="mt-1 text-xs text-gray-400">
              La ricerca è case-insensitive e parziale (es. "farm" trova "farmacia").
            </p>
          </div>
          <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>
            {update.isPending ? 'Salvataggio…' : 'Salva'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function Categories() {
  const { data: categories, isLoading } = useCategories()
  const { toast } = useToast()
  const qc = useQueryClient()

  const recategorize = useMutation({
    mutationFn: () =>
      fetch('/categories/recategorize-all').then(() => transactionsApi.summary()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast(`Ricategorizzate ${data?.updated ?? ''} transazioni`, 'success')
    },
    onError: () => toast('Errore nella ricategorizzazione', 'error'),
  })

  const handleRecategorize = useMutation({
    mutationFn: async () => {
      const { apiFetch } = await import('../api/client')
      return apiFetch<{ updated: number }>('/categories/recategorize-all', { method: 'POST' })
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast(`${data.updated} transazioni ricategorizzate`, 'success')
    },
    onError: () => toast('Errore nella ricategorizzazione', 'error'),
  })

  const expenses = categories?.filter((c) => !c.is_income) ?? []
  const incomes = categories?.filter((c) => c.is_income) ?? []

  return (
    <div>
      <Header
        title="Categorie"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRecategorize.mutate()}
            disabled={handleRecategorize.isPending}
          >
            <RotateCcw size={14} />
            {handleRecategorize.isPending ? 'In corso…' : 'Ricategorizza tutto'}
          </Button>
        }
      />

      <div className="p-4 md:p-6 max-w-lg space-y-5">
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

        {expenses.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Uscite
            </h2>
            <div className="space-y-2">
              {expenses.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
            </div>
          </section>
        )}

        {incomes.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Entrate
            </h2>
            <div className="space-y-2">
              {incomes.map((cat) => <CategoryRow key={cat.id} cat={cat} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
