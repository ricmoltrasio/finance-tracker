import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettings, useUpdateSetting } from '../hooks/useSettings'
import { useCategories } from '../hooks/useCategories'
import { categoriesApi } from '../api/categories'
import { useToast } from '../context/ToastContext'
import { catMeta } from '../types'
import type { Category } from '../types'
import { Icon } from '../components/common/Icon'
import { CatGlyph } from '../components/common/CatGlyph'
import { Spinner } from '../components/common/Spinner'

function CategoryRow({ cat }: { cat: Category }) {
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState(cat.keywords.join(', '))
  const [budgetStr, setBudgetStr] = useState(cat.budget && cat.budget > 0 ? String(cat.budget) : '')
  const { toast } = useToast()
  const qc = useQueryClient()
  const { color } = catMeta(cat.name)

  const update = useMutation({
    mutationFn: () => {
      const kws = keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      const body: Partial<Category> = { keywords: kws }
      if (!cat.is_income) body.budget = budgetStr ? Number(budgetStr) : 0
      return categoriesApi.update(cat.id, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Categoria aggiornata', 'success')
      setOpen(false)
    },
    onError: () => toast('Errore nel salvataggio', 'error'),
  })

  return (
    <div className="cat-acc">
      <button className="cat-acc-head" onClick={() => setOpen((v) => !v)}>
        <CatGlyph category={cat.name} size={34} />
        <div className="cat-acc-name">
          <div className="cat-acc-title">{cat.name}</div>
          {!open && (
            <div className="cat-acc-kw">
              {cat.budget && cat.budget > 0
                ? `${cat.keywords.length > 0 ? cat.keywords.join(', ') : 'Nessuna parola chiave'} · budget €${cat.budget}`
                : cat.keywords.length > 0 ? cat.keywords.join(', ') : 'Nessuna parola chiave'}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-3)' }}>
          <Icon name="chevDown" size={16} stroke={2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.18s' }} />
        </span>
      </button>

      {open && (
        <div className="cat-acc-body">
          <label className="field-label">Parole chiave (separate da virgola)</label>
          <textarea
            className="field"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={5}
            placeholder="es. esselunga, conad, lidl"
          />
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 12px' }}>
            Ricerca case-insensitive e parziale (es. "farm" trova "farmacia").
          </p>
          {!cat.is_income && (
            <>
              <label className="field-label">Budget mensile (€)</label>
              <input
                className="field"
                type="number"
                min="0"
                step="10"
                value={budgetStr}
                onChange={(e) => setBudgetStr(e.target.value)}
                placeholder="es. 500 — lascia vuoto per nessun budget"
                style={{ marginBottom: 12 }}
              />
            </>
          )}
          <button
            className="btn-accent"
            style={{ borderColor: color }}
            onClick={() => update.mutate()}
            disabled={update.isPending}
          >
            {update.isPending ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSetting()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [saldo, setSaldo] = useState('')
  const [valuta, setValuta] = useState('EUR')

  const { data: categories, isLoading: loadingCats } = useCategories()

  const recategorize = useMutation({
    mutationFn: () => categoriesApi.recategorizeAll(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      toast(`${data.updated} transazioni ricategorizzate`, 'success')
    },
    onError: () => toast('Errore nella ricategorizzazione', 'error'),
  })

  useEffect(() => {
    if (settings) {
      setSaldo(settings.saldo_iniziale ?? '0')
      setValuta(settings.valuta ?? 'EUR')
    }
  }, [settings])

  const save = async () => {
    try {
      await update.mutateAsync({ key: 'saldo_iniziale', value: saldo })
      await update.mutateAsync({ key: 'valuta', value: valuta })
      toast('Impostazioni salvate', 'success')
    } catch {
      toast('Errore nel salvataggio', 'error')
    }
  }

  const expenses = categories?.filter((c) => !c.is_income) ?? []
  const incomes = categories?.filter((c) => c.is_income) ?? []

  return (
    <main className="content anim-fade">
      <header className="topbar">
        <div>
          <h1 className="page-title">Impostazioni</h1>
          <p className="page-sub">Preferenze dell'app</p>
        </div>
      </header>

      <div className="settings-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="card-eyebrow" style={{ marginBottom: 8 }}>
            Saldo di partenza
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
            Il saldo del conto quando hai iniziato a usare l'app. Tutti i calcoli dell'andamento
            partono da questo valore.
          </p>
          <label className="field-label">Saldo iniziale (€)</label>
          <input
            className="field"
            type="number"
            step="0.01"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="card">
          <p className="card-eyebrow" style={{ marginBottom: 8 }}>
            Valuta
          </p>
          <select className="field" value={valuta} onChange={(e) => setValuta(e.target.value)}>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollaro</option>
            <option value="GBP">GBP — Sterlina</option>
          </select>
        </div>
      </div>

      <button className="btn-accent" onClick={save} disabled={update.isPending || isLoading}>
        {update.isPending ? 'Salvataggio…' : 'Salva impostazioni'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '36px 0 14px' }}>
        <div>
          <p className="section-label" style={{ margin: 0 }}>Categorie</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            Parole chiave per la categorizzazione automatica
          </p>
        </div>
        <button
          className="btn-soft"
          onClick={() => recategorize.mutate()}
          disabled={recategorize.isPending}
        >
          <Icon name="repeat" size={15} stroke={2} />
          {recategorize.isPending ? 'In corso…' : 'Ricategorizza tutto'}
        </button>
      </div>

      {loadingCats && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {expenses.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p className="section-label">Uscite</p>
          <div className="cat-grid">
            {expenses.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </div>
        </section>
      )}

      {incomes.length > 0 && (
        <section>
          <p className="section-label">Entrate</p>
          <div className="cat-grid">
            {incomes.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
