import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Transaction, TransactionCreate } from '../../types'
import { CATEGORIES, catMeta } from '../../types'
import { Icon } from '../common/Icon'
import { CatGlyph } from '../common/CatGlyph'
import { formatEUR } from '../../utils/format'
import {
  useUpdateTransaction,
  useDeleteTransaction,
  useCreateTransaction,
  useSetCategory,
} from '../../hooks/useTransactions'
import { useToast } from '../../context/ToastContext'
import { SplitForm } from './SplitForm'

const INCOME_CATS = ['Stipendio', 'Contanti', 'Rimborsi']

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
  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <button className="iconbtn" onClick={onClose}>
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
}: {
  transaction: Transaction
  onClose: () => void
}) {
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()
  const setCat = useSetCategory()
  const { toast } = useToast()
  const [showSplit, setShowSplit] = useState(false)
  const [note, setNote] = useState(t.note ?? '')
  const [category, setCategory] = useState(t.category)
  const [amountStr, setAmountStr] = useState(String(Math.abs(t.amount)))

  const inc = t.amount > 0
  const d = new Date(t.date + 'T12:00:00')
  const eligible = CATEGORIES.filter((c) => (inc ? INCOME_CATS.includes(c) : !INCOME_CATS.includes(c)))

  const pickCategory = async (c: string) => {
    setCategory(c)
    const res = await setCat.mutateAsync({ id: t.id, category: c })
    const msg = res.updated > 1 ? `Categoria aggiornata (${res.updated} transazioni)` : 'Categoria aggiornata'
    toast(msg, 'success')
  }

  const saveAmount = async () => {
    const parsed = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(parsed) || parsed === Math.abs(t.amount)) return
    const signed = inc ? Math.abs(parsed) : -Math.abs(parsed)
    await update.mutateAsync({ id: t.id, body: { amount: signed } })
    toast('Importo aggiornato', 'success')
  }

  const saveNote = async () => {
    if (note === (t.note ?? '')) return
    await update.mutateAsync({ id: t.id, body: { note } })
    toast('Nota salvata', 'success')
  }

  const onDelete = async () => {
    if (!confirm('Eliminare questa transazione?')) return
    await del.mutateAsync(t.id)
    toast('Transazione eliminata', 'success')
    onClose()
  }

  return (
    <DrawerShell onClose={onClose} title={showSplit ? 'Dividi transazione' : 'Dettaglio transazione'}>
      {showSplit ? (
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
                      >
                        <CatGlyph category={c} size={15} />
                        {c}
                      </button>
                    )
                  })}
                </div>
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
            <button className="dbtn danger" onClick={onDelete} disabled={del.isPending}>
              <Icon name="close" size={15} /> Elimina
            </button>
          </div>
        </>
      )}
    </DrawerShell>
  )
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
  const create = useCreateTransaction()
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
    await create.mutateAsync(body)
    toast('Transazione aggiunta', 'success')
    onClose()
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
