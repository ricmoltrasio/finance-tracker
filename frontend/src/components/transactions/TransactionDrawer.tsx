import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Transaction, TransactionCreate } from '../../types'
import { CATEGORIES, catMeta } from '../../types'
import { Icon } from '../common/Icon'
import { CatGlyph } from '../common/CatGlyph'
import { formatEUR, capitalize } from '../../utils/format'
import {
  useUpdateTransaction,
  useDeleteTransaction,
  useCreateTransaction,
  useSetCategory,
  useSetLocation,
} from '../../hooks/useTransactions'
import { transactionsApi } from '../../api/transactions'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { SplitForm } from './SplitForm'

const INCOME_CATS = ['Stipendio', 'Contanti', 'Rimborsi']

/** Toggle: limita la modifica alla singola transazione (niente regola/propagazione). */
function OnlyThisToggle({
  checked,
  onChange,
  hint = 'Se attivo, la modifica non viene applicata alle altre transazioni con la stessa descrizione',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10 }}
      title={hint}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Applica solo a questa transazione"
        className={'switch' + (checked ? ' on' : '')}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
      <span
        style={{ fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => onChange(!checked)}
      >
        Applica solo a questa transazione
      </span>
    </div>
  )
}

/** Riepilogo "applica a tutte": lista selezionabile di transazioni con la stessa descrizione. */
function AffectedTransactionsPanel({
  message,
  transactions,
  selectedIds,
  onToggle,
  onCancel,
  onConfirm,
  confirmLabel,
  pending,
}: {
  message: React.ReactNode
  transactions: Transaction[]
  selectedIds: Set<number>
  onToggle: (id: number) => void
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  pending: boolean
}) {
  return (
    <div>
      <button className="btn-soft" style={{ marginBottom: 16 }} onClick={onCancel}>
        ← Torna al dettaglio
      </button>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{message}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflowY: 'auto', marginBottom: 20 }}>
        {transactions.map((tx) => {
          const txInc = tx.amount > 0
          const txD = new Date(tx.date + 'T12:00:00')
          const checked = selectedIds.has(tx.id)
          return (
            <button
              key={tx.id}
              onClick={() => onToggle(tx.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10, fontSize: 13,
                background: checked ? 'var(--surface-2)' : 'transparent',
                border: '1px solid ' + (checked ? 'var(--line-2)' : 'transparent'),
                opacity: checked ? 1 : 0.45,
                textAlign: 'left', cursor: 'pointer', width: '100%',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--line-2)'),
                background: checked ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <Icon name="check" size={11} stroke={2.5} style={{ color: '#06120e' }} />}
              </span>
              <span style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                {txD.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })}
              </span>
              <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.description}
              </span>
              <span className={'txrow-amt ' + (txInc ? 'in' : 'out')} style={{ fontSize: 13, flexShrink: 0 }}>
                {formatEUR(tx.amount, { plus: txInc })}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-soft" onClick={onCancel}>Annulla</button>
        <button
          className="btn-accent"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={onConfirm}
          disabled={pending || selectedIds.size === 0}
        >
          {pending ? 'Aggiornamento…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── shell ────────────────────────────────────────────────────────────────────

function DrawerShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  // Chiusura con Escape (accessibilità tastiera)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── edit ─────────────────────────────────────────────────────────────────────

export function EditDrawer({
  transaction: t,
  onClose,
  variant = 'overlay',
}: {
  transaction: Transaction
  onClose: () => void
  /** 'embedded' renderizza il pannello inline (no scrim, opacità piena) — usato dalla Mappa */
  variant?: 'overlay' | 'embedded'
}) {
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const setCat = useSetCategory()
  const setLoc = useSetLocation()
  const { toast } = useToast()
  const [showSplit, setShowSplit] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [note, setNote] = useState(t.note ?? '')
  const [category, setCategory] = useState(t.category)
  const [amountStr, setAmountStr] = useState(String(Math.abs(t.amount)))
  const [onlyThis, setOnlyThis] = useState(false)
  const [pendingCat, setPendingCat] = useState<{ category: string; affected: Transaction[] } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [previewLoading, setPreviewLoading] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const [onlyThisLoc, setOnlyThisLoc] = useState(false)
  const [pendingLoc, setPendingLoc] = useState<{ city: string; affected: Transaction[] } | null>(null)
  const [selectedLocIds, setSelectedLocIds] = useState<Set<number>>(new Set())
  const [locPreviewLoading, setLocPreviewLoading] = useState(false)

  const inc = t.amount > 0
  const d = new Date(t.date + 'T12:00:00')
  const eligible = CATEGORIES.filter((c) => (inc ? INCOME_CATS.includes(c) : !INCOME_CATS.includes(c)))

  const applyCategory = async (cat: string, only: boolean, ids?: number[]) => {
    setCategory(cat)
    try {
      const res = await setCat.mutateAsync({ id: t.id, category: cat, onlyThis: only, ids })
      toast(res.updated > 1 ? `Categoria aggiornata (${res.updated} transazioni)` : 'Categoria aggiornata', 'success')
    } catch {
      setCategory(t.category)
      toast("Errore nell'aggiornamento della categoria", 'error')
    }
    setPendingCat(null)
  }

  const pickCategory = async (c: string) => {
    if (onlyThis) { applyCategory(c, true); return }
    setPreviewLoading(true)
    try {
      const preview = await transactionsApi.setCategory(t.id, c, false, true)
      if (preview.updated <= 1) {
        applyCategory(c, false)
      } else {
        setPendingCat({ category: c, affected: preview.transactions })
        setSelectedIds(new Set(preview.transactions.map((tx) => tx.id)))
      }
    } catch {
      toast("Errore nel calcolo anteprima", 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  const toggleId = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const applyLocation = async (city: string, only: boolean, ids?: number[]) => {
    const clearing = !city.trim()
    try {
      const res = await setLoc.mutateAsync({ id: t.id, city, onlyThis: only, ids })
      const verb = clearing ? 'rimossa' : 'aggiornata'
      toast(res.updated > 1 ? `Posizione ${verb} (${res.updated} transazioni)` : `Posizione ${verb}`, 'success')
      setCityInput('')
    } catch (e) {
      toast(errorMessage(e, "Errore nell'aggiornamento della posizione"), 'error')
    }
    setPendingLoc(null)
  }

  const pickLocation = async () => {
    const city = cityInput.trim()
    if (onlyThisLoc) { applyLocation(city, true); return }
    setLocPreviewLoading(true)
    try {
      const preview = await transactionsApi.setLocation(t.id, city, false, true)
      if (preview.updated <= 1) {
        applyLocation(city, false)
      } else {
        setPendingLoc({ city, affected: preview.transactions })
        setSelectedLocIds(new Set(preview.transactions.map((tx) => tx.id)))
      }
    } catch (e) {
      toast(errorMessage(e, 'Errore nel calcolo anteprima'), 'error')
    } finally {
      setLocPreviewLoading(false)
    }
  }

  const toggleLocId = (id: number) =>
    setSelectedLocIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const saveAmount = async () => {
    const parsed = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(parsed) || parsed === Math.abs(t.amount)) return
    const signed = inc ? Math.abs(parsed) : -Math.abs(parsed)
    try {
      await update.mutateAsync({ id: t.id, body: { amount: signed } })
      toast('Importo aggiornato', 'success')
    } catch {
      toast("Errore nell'aggiornamento dell'importo", 'error')
    }
  }

  const saveNote = async () => {
    if (note === (t.note ?? '')) return
    try {
      await update.mutateAsync({ id: t.id, body: { note } })
      toast('Nota salvata', 'success')
    } catch {
      toast('Errore nel salvataggio della nota', 'error')
    }
  }

  const doDelete = async () => {
    try {
      await del.mutateAsync(t.id)
      toast('Transazione eliminata', 'success')
      onClose()
    } catch {
      toast("Errore nell'eliminazione", 'error')
    }
  }

  const title =
    pendingCat ? 'Riepilogo aggiornamento' :
    pendingLoc ? 'Riepilogo aggiornamento' :
    showSplit   ? 'Dividi transazione'     : 'Dettaglio transazione'

  const body = (
    <>
      {pendingCat ? (
        <AffectedTransactionsPanel
          message={<>
            Aggiornando <strong style={{ color: catMeta(pendingCat.category).color }}>{pendingCat.category}</strong> verranno
            modificate <strong>{pendingCat.affected.length}</strong> transazioni con la stessa descrizione:
          </>}
          transactions={pendingCat.affected}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onCancel={() => setPendingCat(null)}
          onConfirm={() => applyCategory(pendingCat.category, false, [...selectedIds])}
          confirmLabel={`Conferma (${selectedIds.size})`}
          pending={setCat.isPending}
        />
      ) : pendingLoc ? (
        <AffectedTransactionsPanel
          message={
            pendingLoc.city ? (
              <>
                Impostando la posizione su <strong>{capitalize(pendingLoc.city)}</strong> verranno
                modificate <strong>{pendingLoc.affected.length}</strong> transazioni con la stessa descrizione:
              </>
            ) : (
              <>
                Rimuovendo la posizione verranno modificate <strong>{pendingLoc.affected.length}</strong> transazioni
                con la stessa descrizione:
              </>
            )
          }
          transactions={pendingLoc.affected}
          selectedIds={selectedLocIds}
          onToggle={toggleLocId}
          onCancel={() => setPendingLoc(null)}
          onConfirm={() => applyLocation(pendingLoc.city, false, [...selectedLocIds])}
          confirmLabel={`Conferma (${selectedLocIds.size})`}
          pending={setLoc.isPending}
        />
      ) : showSplit ? (
        <div>
          <button
            className="btn-soft"
            style={{ marginBottom: 16 }}
            onClick={() => setShowSplit(false)}
          >
            ← Torna al dettaglio
          </button>
          <SplitForm transaction={t} onClose={onClose} />
        </div>
      ) : (
        <>
          <div className="drawer-amount">
            <CatGlyph category={category} size={46} />
            <div>
              <div className={'drawer-amt ' + (inc ? 'in' : 'out')}>
                {formatEUR(t.amount, { plus: inc })}
              </div>
              <div className="drawer-desc">{t.description}</div>
            </div>
          </div>

          <dl className="drawer-rows">
            <div>
              <dt>Data</dt>
              <dd style={{ textTransform: 'capitalize' }}>
                {d.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </dd>
            </div>
            <div>
              <dt>Importo (€)</dt>
              <dd>
                <input
                  className="field"
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  style={{ width: 120, textAlign: 'right' }}
                  onChange={(e) => setAmountStr(e.target.value)}
                  onBlur={saveAmount}
                />
                {t.orig_amount != null && t.orig_amount !== t.amount && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '4px 0 0', textAlign: 'right' }}>
                    originale: {formatEUR(t.orig_amount)}
                  </p>
                )}
              </dd>
            </div>
            <div>
              <dt>Fonte</dt>
              <dd>{t.source === 'manuale' ? 'Inserita manualmente' : 'Import bancario'}</dd>
            </div>
            <div className="drawer-catrow">
              <dt>Categoria</dt>
              <dd>
                <div className="catselect">
                  {eligible.map((c) => {
                    const { color } = catMeta(c)
                    const on = c === category
                    return (
                      <button
                        key={c}
                        className="catchip"
                        style={
                          on
                            ? { color, borderColor: color + '66', background: color + '1f' }
                            : undefined
                        }
                        onClick={() => pickCategory(c)}
                        disabled={previewLoading || setCat.isPending}
                      >
                        <CatGlyph category={c} size={15} />
                        {c}
                      </button>
                    )
                  })}
                </div>
                <OnlyThisToggle checked={onlyThis} onChange={setOnlyThis} />
              </dd>
            </div>
            <div className="drawer-catrow">
              <dt>Posizione</dt>
              <dd>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field"
                    type="text"
                    placeholder={t.city ? 'Lascia vuoto per rimuovere' : 'es. Monza'}
                    value={cityInput}
                    style={{ flex: 1 }}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pickLocation() } }}
                  />
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={pickLocation}
                    disabled={(!cityInput.trim() && !t.city) || locPreviewLoading || setLoc.isPending}
                  >
                    {locPreviewLoading ? 'Verifica…' : 'Salva'}
                  </button>
                </div>
                {t.city && (
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                    Attuale: {capitalize(t.city)}
                  </p>
                )}
                <OnlyThisToggle checked={onlyThisLoc} onChange={setOnlyThisLoc} />
              </dd>
            </div>
          </dl>

          <label className="drawer-note">
            <span>Note</span>
            <textarea
              rows={2}
              placeholder="Aggiungi una nota…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
            />
          </label>

          <div className="drawer-actions">
            {!t.is_split && (
              <button className="dbtn ghost" onClick={() => setShowSplit(true)}>
                <Icon name="tag" size={15} /> Dividi
              </button>
            )}
            <button className="dbtn danger" onClick={() => setShowConfirmDelete(true)} disabled={del.isPending}>
              <Icon name="close" size={15} /> Elimina
            </button>
          </div>
        </>
      )}
      {showConfirmDelete && (
        <ConfirmDialog
          message="Eliminare questa transazione? Sarà nascosta ma potrai ripristinarla dalla Panoramica."
          confirmLabel="Elimina"
          onConfirm={() => { setShowConfirmDelete(false); doDelete() }}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}
    </>
  )

  if (variant === 'embedded') {
    return (
      <div className="mappa-sidebar">
        <div className="mappa-sidebar-header">
          <span className="drawer-title">{title}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="drawer-embedded-body">{body}</div>
      </div>
    )
  }

  return <DrawerShell onClose={onClose} title={title}>{body}</DrawerShell>
}

// ── create ───────────────────────────────────────────────────────────────────

type CreateForm = {
  date: string
  description: string
  amount: string
  category: string
  note: string
}

export function CreateDrawer({ onClose }: { onClose: () => void }) {
  const [isIncome, setIsIncome] = useState(false)
  const [onlyThis, setOnlyThis] = useState(false)
  const create = useCreateTransaction()
  const setCat = useSetCategory()
  const { toast } = useToast()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: 'Cibo',
    },
  })

  const category = watch('category')
  const eligible = CATEGORIES.filter((c) =>
    isIncome ? INCOME_CATS.includes(c) : !INCOME_CATS.includes(c)
  )

  const toggle = (income: boolean) => {
    setIsIncome(income)
    setValue('category', income ? 'Stipendio' : 'Cibo')
  }

  const onSubmit = handleSubmit(async (data) => {
    const raw = parseFloat(data.amount.replace(',', '.'))
    const amount = isIncome ? Math.abs(raw) : -Math.abs(raw)
    const body: TransactionCreate = {
      date: data.date,
      description: data.description,
      amount,
      category: data.category,
      source: 'manuale',
      note: data.note,
    }
    try {
      const created = await create.mutateAsync(body)
      // Default: la categoria scelta vale anche per le altre transazioni con la
      // stessa descrizione (crea la regola). Col toggle resta solo su questa.
      if (!onlyThis) {
        await setCat.mutateAsync({ id: created.id, category: created.category, onlyThis: false })
      }
      toast('Transazione aggiunta', 'success')
      onClose()
    } catch {
      toast("Errore nell'aggiunta della transazione", 'error')
    }
  })

  return (
    <DrawerShell onClose={onClose} title="Nuova transazione">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="seg">
          <button type="button" className={!isIncome ? 'on out' : ''} onClick={() => toggle(false)}>
            Uscita
          </button>
          <button type="button" className={isIncome ? 'on in' : ''} onClick={() => toggle(true)}>
            Entrata
          </button>
        </div>

        <div>
          <label className="field-label">Data</label>
          <input className="field" type="date" {...register('date', { required: true })} />
        </div>

        <div>
          <label className="field-label">Descrizione</label>
          <input
            className="field"
            type="text"
            placeholder="es. Esselunga"
            {...register('description', { required: true })}
          />
          {errors.description && (
            <p style={{ fontSize: 12, color: 'var(--out)', marginTop: 4 }}>Campo obbligatorio</p>
          )}
        </div>

        <div>
          <label className="field-label">Importo (€)</label>
          <input
            className="field"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            {...register('amount', { required: true })}
          />
          {errors.amount && (
            <p style={{ fontSize: 12, color: 'var(--out)', marginTop: 4 }}>Campo obbligatorio</p>
          )}
        </div>

        <div>
          <label className="field-label">Categoria</label>
          <div className="catselect">
            {eligible.map((c) => {
              const { color } = catMeta(c)
              const on = c === category
              return (
                <button
                  type="button"
                  key={c}
                  className="catchip"
                  style={
                    on ? { color, borderColor: color + '66', background: color + '1f' } : undefined
                  }
                  onClick={() => setValue('category', c)}
                >
                  <CatGlyph category={c} size={15} />
                  {c}
                </button>
              )
            })}
          </div>
          <OnlyThisToggle checked={onlyThis} onChange={setOnlyThis} />
        </div>

        <div>
          <label className="field-label">Note (opzionale)</label>
          <textarea className="field" rows={2} {...register('note')} />
        </div>

        <button
          type="submit"
          className="btn-accent"
          style={{ justifyContent: 'center', padding: 11 }}
          disabled={create.isPending}
        >
          {create.isPending ? 'Salvataggio…' : 'Aggiungi transazione'}
        </button>
      </form>
    </DrawerShell>
  )
}
