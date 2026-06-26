import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettings, useUpdateSetting } from '../hooks/useSettings'
import { useCategories } from '../hooks/useCategories'
import { categoriesApi } from '../api/categories'
import type { RecategorizeChange } from '../api/categories'
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

function RecategorizeDrawer({
  changes,
  onApply,
  onClose,
  applying,
}: {
  changes: RecategorizeChange[]
  onApply: () => void
  onClose: () => void
  applying: boolean
}) {
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">Anteprima ricategorizzazione</span>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" size={18} />
          </button>
        </div>

        {changes.length === 0 ? (
          <p style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            Nessuna transazione da aggiornare.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              {changes.length} {changes.length === 1 ? 'transazione verrà aggiornata' : 'transazioni verranno aggiornate'}.
              Controlla e conferma.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '55vh', overflowY: 'auto', marginBottom: 20 }}>
              {changes.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)',
                  fontSize: 13,
                }}>
                  <CatGlyph category={c.from_cat} size={28} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {c.description}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    <span style={{ color: catMeta(c.from_cat).color }}>{c.from_cat}</span>
                    {' → '}
                    <span style={{ color: catMeta(c.to_cat).color, fontWeight: 600 }}>{c.to_cat}</span>
                  </span>
                  <CatGlyph category={c.to_cat} size={28} />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-soft" onClick={onClose} disabled={applying}>Annulla</button>
          {changes.length > 0 && (
            <button className="btn-accent" onClick={onApply} disabled={applying}>
              {applying ? 'Applicazione…' : 'Applica'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSetting()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [saldo, setSaldo] = useState('')
  const [reviewChanges, setReviewChanges] = useState<RecategorizeChange[] | null>(null)
  const [pendingAction, setPendingAction] = useState<'all' | 'uncategorized' | null>(null)

  const { data: categories, isLoading: loadingCats } = useCategories()

  const preview = useMutation({
    mutationFn: (mode: 'all' | 'uncategorized') =>
      mode === 'all'
        ? categoriesApi.recategorizeAll(true)
        : categoriesApi.recategorizeUncategorized(true),
    onSuccess: (data, mode) => {
      setReviewChanges(data.changes)
      setPendingAction(mode)
    },
    onError: () => toast('Errore nel calcolo anteprima', 'error'),
  })

  const apply = useMutation({
    mutationFn: () =>
      pendingAction === 'all'
        ? categoriesApi.recategorizeAll(false)
        : categoriesApi.recategorizeUncategorized(false),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setReviewChanges(null)
      setPendingAction(null)
      toast(data.updated > 0 ? `${data.updated} transazioni aggiornate` : 'Nessuna transazione aggiornata', 'success')
    },
    onError: () => toast('Errore nella ricategorizzazione', 'error'),
  })

  useEffect(() => {
    if (settings) setSaldo(settings.saldo_iniziale ?? '0')
  }, [settings])

  const save = async () => {
    try {
      await update.mutateAsync({ key: 'saldo_iniziale', value: saldo })
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

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '10px 14px' }}>
        <p className="card-eyebrow" style={{ margin: 0, whiteSpace: 'nowrap' }}>Saldo di partenza</p>
        <input
          className="field"
          type="number"
          step="0.01"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          disabled={isLoading}
          style={{ width: 140, margin: 0 }}
        />
        <button className="btn-accent" onClick={save} disabled={update.isPending || isLoading} style={{ whiteSpace: 'nowrap' }}>
          {update.isPending ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '36px 0 14px' }}>
        <div>
          <p className="section-label" style={{ margin: 0 }}>Categorie</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            Parole chiave per la categorizzazione automatica
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-soft"
            onClick={() => preview.mutate('uncategorized')}
            disabled={preview.isPending}
          >
            <Icon name="repeat" size={15} stroke={2} />
            {preview.isPending && pendingAction === 'uncategorized' ? 'Calcolo…' : 'Solo "Altro"'}
          </button>
          <button
            className="btn-soft"
            onClick={() => preview.mutate('all')}
            disabled={preview.isPending}
          >
            <Icon name="repeat" size={15} stroke={2} />
            {preview.isPending && pendingAction === 'all' ? 'Calcolo…' : 'Ricategorizza tutto'}
          </button>
        </div>
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

      {reviewChanges !== null && (
        <RecategorizeDrawer
          changes={reviewChanges}
          applying={apply.isPending}
          onApply={() => apply.mutate()}
          onClose={() => { setReviewChanges(null); setPendingAction(null) }}
        />
      )}
    </main>
  )
}
