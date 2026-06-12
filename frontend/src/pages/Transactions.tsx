import { useState, useMemo } from 'react'
import { useSessionState } from '../hooks/useSessionState'
import { useTransactions } from '../hooks/useTransactions'
import { TransactionList } from '../components/transactions/TransactionList'
import { MerchantGroupList } from '../components/transactions/MerchantGroupList'
import { EditDrawer, CreateDrawer } from '../components/transactions/TransactionDrawer'
import { Icon } from '../components/common/Icon'
import { CategorySelect } from '../components/common/CategorySelect'
import type { Transaction } from '../types'
import { CATEGORIES } from '../types'
import { today } from '../utils/format'
import { iso, lastNMonths, monthRange } from '../utils/period'

const PAGE_SIZE = 50

// ── periodi ──────────────────────────────────────────────────────────────────

type PeriodKey = 'mese' | '3m' | '6m' | '12m' | 'anno' | 'tutto'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'tutto', label: 'Tutto' },
  { key: 'mese',  label: 'Questo mese' },
  { key: '3m',    label: '3 mesi' },
  { key: '6m',    label: '6 mesi' },
  { key: '12m',   label: '12 mesi' },
  { key: 'anno',  label: "Quest'anno" },
]

function getRange(key: PeriodKey): { from: string; to: string } | null {
  if (key === 'tutto') return null
  const end = new Date()
  let start: Date
  if (key === 'mese') {
    start = new Date(end.getFullYear(), end.getMonth(), 1)
  } else if (key === '3m') {
    start = new Date(end); start.setMonth(start.getMonth() - 3); start.setDate(start.getDate() + 1)
  } else if (key === '6m') {
    start = new Date(end); start.setMonth(start.getMonth() - 6); start.setDate(start.getDate() + 1)
  } else if (key === '12m') {
    start = new Date(end); start.setMonth(start.getMonth() - 12); start.setDate(start.getDate() + 1)
  } else {
    start = new Date(end.getFullYear(), 0, 1)
  }
  return { from: iso(start), to: iso(end) }
}

// ── sort ──────────────────────────────────────────────────────────────────────

type SortBy = 'date' | 'amount' | 'category' | 'description'

const SORT_FIELDS: { key: SortBy; label: string; defaultDir: 'asc' | 'desc' }[] = [
  { key: 'date',        label: 'Data',       defaultDir: 'desc' },
  { key: 'amount',      label: 'Importo',    defaultDir: 'asc'  },
  { key: 'category',    label: 'Categoria',  defaultDir: 'asc'  },
  { key: 'description', label: 'Alfabetico', defaultDir: 'asc'  },
]

// ── pagina ────────────────────────────────────────────────────────────────────

export default function Transactions() {
  const [search, setSearch]         = useSessionState('tx.search', '')
  const [category, setCategory]     = useSessionState('tx.category', '')
  const [groupMerchants, setGroupMerchants] = useSessionState('tx.group', false)
  const [period, setPeriod]         = useSessionState<PeriodKey>('tx.period', '3m')
  const [customFrom, setCustomFrom] = useSessionState('tx.from', '')
  const [customTo, setCustomTo]     = useSessionState('tx.to', today())
  const [customMonth, setCustomMonth] = useSessionState('tx.month', '')
  const [sortBy, setSortBy]         = useSessionState<SortBy>('tx.sortBy', 'date')
  const [sortDir, setSortDir]       = useSessionState<'asc' | 'desc'>('tx.sortDir', 'desc')
  const [offset, setOffset]         = useSessionState('tx.offset', 0)
  const [selected, setSelected]     = useState<Transaction | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const monthOptions = useMemo(() => lastNMonths(), [])

  const range = getRange(period)
  const from = customFrom || range?.from
  const to   = customTo   || range?.to

  const pickSort = (key: SortBy) => {
    if (key === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(SORT_FIELDS.find(f => f.key === key)!.defaultDir)
    }
    setOffset(0)
  }

  const resetSort = () => {
    setSortBy('date')
    setSortDir('desc')
    setOffset(0)
  }

  const params = {
    search:   search   || undefined,
    category: category || undefined,
    from:     from     || undefined,
    to:       to       || undefined,
    sort_by:  sortBy,
    sort_dir: sortDir,
    // in modalità "raggruppa esercenti" carichiamo l'intero set filtrato (no paginazione)
    limit:    groupMerchants ? 500 : PAGE_SIZE,
    offset:   groupMerchants ? 0 : offset,
  }

  const { data, isLoading } = useTransactions(params)
  const total = data?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)
  const page  = Math.floor(offset / PAGE_SIZE)

  const resetPage = () => setOffset(0)

  return (
    <>
      <main className="content anim-fade">
        <header className="topbar">
          <div>
            <h1 className="page-title">Transazioni</h1>
            <p className="page-sub">{total} movimenti</p>
          </div>
          <div className="topbar-r">
            <button className="btn-accent" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={16} stroke={2.2} /> Aggiungi
            </button>
          </div>
        </header>

        {/* riga 1: period pills + mese + cerca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <div className="periodbar" style={{ margin: 0, flex: '0 0 auto' }} role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key && !customMonth}
                className={'pill' + (period === p.key && !customMonth ? ' on' : '')}
                onClick={() => { setPeriod(p.key); setCustomFrom(''); setCustomMonth(''); resetPage() }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            className={'pill-select' + (customMonth ? ' on' : '')}
            value={customMonth}
            onChange={(e) => {
              const val = e.target.value
              setCustomMonth(val)
              if (val) {
                const r = monthRange(val)
                setCustomFrom(r.from)
                setCustomTo(r.to)
              }
              resetPage()
            }}
          >
            <option value="">Mese…</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div style={{ marginLeft: 'auto' }} />
          <CategorySelect
            value={category}
            options={CATEGORIES}
            onChange={(v) => { setCategory(v); resetPage() }}
          />
          <div className="field-icon" style={{ flex: '0 0 auto', width: 210, minWidth: 'auto' }}>
            <Icon name="search" size={14} />
            <input
              className="field"
              type="text"
              placeholder="Cerca per descrizione…"
              style={{ fontSize: 12.5, padding: '6px 10px 6px 32px', borderRadius: 9 }}
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
            />
          </div>
        </div>

        {/* riga 2: ordina + categoria + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="sortbar" style={{ margin: 0, flex: '0 0 auto' }}>
            <span className="sortbar-label">Ordina</span>
            {SORT_FIELDS.map((f) => {
              const active = f.key === sortBy
              const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
              return (
                <button
                  key={f.key}
                  className={'sortpill' + (active ? ' on' : '')}
                  onClick={() => pickSort(f.key)}
                  onDoubleClick={active ? resetSort : undefined}
                >
                  {f.label}{arrow}
                </button>
              )
            })}
          </div>
          <button
            className={'sortpill' + (groupMerchants ? ' on' : '')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={() => setGroupMerchants((v) => !v)}
            title="Raggruppa le transazioni per esercente"
          >
            <Icon name="grid" size={13} stroke={2} />
            Raggruppa esercenti
          </button>
          <div style={{ marginLeft: 'auto' }} />
          <input
            className="field field-sm"
            type="date"
            value={customFrom || range?.from || ''}
            onChange={(e) => { setCustomFrom(e.target.value); resetPage() }}
          />
          <input
            className="field field-sm"
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); resetPage() }}
          />
        </div>

        {/* lista */}
        <div className="card" style={{ padding: 8 }}>
          {groupMerchants ? (
            <MerchantGroupList
              transactions={data?.data ?? []}
              loading={isLoading}
              onSelect={(t) => setSelected(t)}
            />
          ) : (
            <TransactionList
              transactions={data?.data ?? []}
              loading={isLoading}
              onSelect={(t) => setSelected(t)}
            />
          )}
        </div>

        {/* paginazione */}
        {!groupMerchants && total > PAGE_SIZE && (
          <div className="pager">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} di {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="pager-btn"
                disabled={page === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Prec
              </button>
              <span style={{ color: 'var(--text-2)' }}>
                {page + 1} / {pages}
              </span>
              <button
                className="pager-btn"
                disabled={page >= pages - 1}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Succ →
              </button>
            </div>
          </div>
        )}
      </main>

      {selected && <EditDrawer transaction={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} />}
    </>
  )
}
