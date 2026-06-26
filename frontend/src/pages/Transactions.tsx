import { useState, useMemo, useEffect, useRef } from 'react'
import { useSessionState } from '../hooks/useSessionState'
import { useInfiniteTransactions } from '../hooks/useTransactions'
import { TransactionList } from '../components/transactions/TransactionList'
import { MerchantGroupList } from '../components/transactions/MerchantGroupList'
import { EditDrawer, CreateDrawer } from '../components/transactions/TransactionDrawer'
import { Icon } from '../components/common/Icon'
import { CategorySelect } from '../components/common/CategorySelect'
import { PeriodChip } from '../components/common/PeriodChip'
import { MobileSheet } from '../components/common/MobileSheet'
import { Spinner } from '../components/common/Spinner'
import { useIsMobile } from '../hooks/useIsMobile'
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
  const [search, setSearch]               = useSessionState('tx.search', '')
  const [category, setCategory]           = useSessionState('tx.category', '')
  const [groupMerchants, setGroupMerchants] = useSessionState('tx.group', false)
  const [period, setPeriod]               = useSessionState<PeriodKey>('tx.period', '3m')
  const [customFrom, setCustomFrom]       = useSessionState('tx.from', '')
  const [customTo, setCustomTo]           = useSessionState('tx.to', today())
  const [customMonth, setCustomMonth]     = useSessionState('tx.month', '')
  const [sortBy, setSortBy]               = useSessionState<SortBy>('tx.sortBy', 'date')
  const [sortDir, setSortDir]             = useSessionState<'asc' | 'desc'>('tx.sortDir', 'desc')
  const [selected, setSelected]           = useState<Transaction | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [showFilters, setShowFilters]     = useState(false)
  const sentinelRef                       = useRef<HTMLDivElement>(null)

  const isMobile    = useIsMobile()
  const monthOptions = useMemo(() => lastNMonths(), [])

  const activeFilters = [
    category !== '',
    groupMerchants,
    customMonth !== '' || period !== '3m',
  ].filter(Boolean).length

  const range = getRange(period)
  const from  = customFrom || range?.from
  const to    = customTo   || range?.to

  const pickSort = (key: SortBy) => {
    if (key === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(SORT_FIELDS.find(f => f.key === key)!.defaultDir)
    }
  }

  const resetSort = () => { setSortBy('date'); setSortDir('desc') }

  const baseParams = {
    search:   search   || undefined,
    category: category || undefined,
    from:     from     || undefined,
    to:       to       || undefined,
    sort_by:  sortBy,
    sort_dir: sortDir,
  }

  // Modalità "raggruppa esercenti" carica tutto in una pagina (500);
  // altrimenti carica 50 per volta con scroll infinito.
  const pageSize = groupMerchants ? 500 : PAGE_SIZE

  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteTransactions(baseParams, pageSize)

  const transactions = infiniteData?.pages.flatMap(p => p.data) ?? []
  const total        = infiniteData?.pages[0]?.total ?? 0

  // Sentinel per lo scroll infinito: quando entra nel viewport carica la pagina successiva.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || groupMerchants) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, groupMerchants])

  return (
    <>
      <main className="content anim-fade">
        <header className="topbar">
          <div>
            <h1 className="page-title">Transazioni</h1>
            <p className="page-sub">{total} movimenti</p>
          </div>
          {!isMobile && (
            <div className="topbar-r">
              <button className="btn-accent" onClick={() => setShowCreate(true)}>
                <Icon name="plus" size={16} stroke={2.2} /> Aggiungi
              </button>
            </div>
          )}
        </header>

        {isMobile ? (
          /* ── mobile: ricerca + bottone Filtri ── */
          <div className="filterbar">
            <div className="field-icon" style={{ flex: 1 }}>
              <Icon name="search" size={15} />
              <input
                className="field"
                type="text"
                placeholder="Cerca…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="filter-btn" onClick={() => setShowFilters(true)}>
              <Icon name="grid" size={15} stroke={2} />
              Filtri
              {activeFilters > 0 && <span className="cnt">{activeFilters}</span>}
            </button>
          </div>
        ) : (
          <>
            {/* riga 1: period pills + mese + cerca */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div className="periodbar" style={{ margin: 0, flex: '0 0 auto' }} role="tablist">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    role="tab"
                    aria-selected={period === p.key && !customMonth}
                    className={'pill' + (period === p.key && !customMonth ? ' on' : '')}
                    onClick={() => { setPeriod(p.key); setCustomFrom(''); setCustomMonth('') }}
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
                onChange={(v) => setCategory(v)}
              />
              <div className="field-icon" style={{ flex: '0 0 auto', width: 210, minWidth: 'auto' }}>
                <Icon name="search" size={14} />
                <input
                  className="field"
                  type="text"
                  placeholder="Cerca per descrizione…"
                  style={{ fontSize: 12.5, padding: '6px 10px 6px 32px', borderRadius: 9 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* riga 2: ordina + raggruppa + date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div className="sortbar" style={{ margin: 0, flex: '0 0 auto' }}>
                <span className="sortbar-label">Ordina</span>
                {SORT_FIELDS.map((f) => {
                  const active = f.key === sortBy
                  const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
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
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                className="field field-sm"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        {/* lista */}
        <div className="card" style={{ padding: 8 }}>
          {groupMerchants ? (
            <MerchantGroupList
              transactions={transactions}
              loading={isLoading}
              onSelect={(t) => setSelected(t)}
            />
          ) : (
            <TransactionList
              transactions={transactions}
              loading={isLoading}
              onSelect={(t) => setSelected(t)}
            />
          )}
        </div>

        {/* sentinel invisibile: l'observer lo vede e carica la pagina successiva */}
        {!groupMerchants && <div ref={sentinelRef} style={{ height: 1 }} />}

        {isFetchingNextPage && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Spinner />
          </div>
        )}

        {isMobile && (
          <button className="fab" aria-label="Aggiungi transazione" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={24} stroke={2.4} />
          </button>
        )}
      </main>

      {isMobile && showFilters && (
        <MobileSheet title="Filtri" onClose={() => setShowFilters(false)}>
          <div className="sheet-label" style={{ marginTop: 4 }}>Periodo</div>
          <PeriodChip
            options={PERIODS}
            value={period}
            onChange={(k) => { setPeriod(k as typeof period); setCustomFrom(''); setCustomMonth('') }}
          />

          <div className="sheet-label">Mese specifico</div>
          <select
            className="field"
            value={customMonth}
            onChange={(e) => {
              const val = e.target.value
              setCustomMonth(val)
              if (val) {
                const r = monthRange(val)
                setCustomFrom(r.from)
                setCustomTo(r.to)
              }
            }}
          >
            <option value="">Nessuno</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="sheet-label">Categoria</div>
          <CategorySelect
            value={category}
            options={CATEGORIES}
            onChange={(v) => setCategory(v)}
          />

          <div className="sheet-label">Intervallo date</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="field"
              type="date"
              value={customFrom || range?.from || ''}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <input
              className="field"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>

          <div className="sheet-label">Ordina</div>
          <div className="sortbar" style={{ margin: 0 }}>
            {SORT_FIELDS.map((f) => {
              const active = f.key === sortBy
              const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
              return (
                <button
                  key={f.key}
                  className={'sortpill' + (active ? ' on' : '')}
                  onClick={() => pickSort(f.key)}
                >
                  {f.label}{arrow}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18 }}>
            <button
              type="button"
              role="switch"
              aria-checked={groupMerchants}
              aria-label="Raggruppa esercenti"
              className={'switch' + (groupMerchants ? ' on' : '')}
              onClick={() => setGroupMerchants((v) => !v)}
            >
              <span className="switch-knob" />
            </button>
            <span
              style={{ fontSize: 13.5, color: 'var(--text-2)' }}
              onClick={() => setGroupMerchants((v) => !v)}
            >
              Raggruppa esercenti
            </span>
          </div>

          <button
            className="btn-accent"
            style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
            onClick={() => setShowFilters(false)}
          >
            Mostra risultati
          </button>
        </MobileSheet>
      )}

      {selected && <EditDrawer transaction={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} />}
    </>
  )
}
