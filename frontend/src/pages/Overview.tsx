import { useState, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSummary } from '../hooks/useSummary'
import { useTimeline } from '../hooks/useTimeline'
import { useTransactions } from '../hooks/useTransactions'
import { useCountUp } from '../hooks/useCountUp'
import { SaldoChart } from '../components/charts/SaldoChart'
import { SpendingBars } from '../components/charts/SpendingBars'
import type { SpendingSeries } from '../components/charts/SpendingBars'
import { Icon } from '../components/common/Icon'
import { CatGlyph } from '../components/common/CatGlyph'
import { Spinner } from '../components/common/Spinner'
import { EditDrawer, CreateDrawer } from '../components/transactions/TransactionDrawer'
import { useToast } from '../context/ToastContext'
import { formatEUR, today } from '../utils/format'
import { iso, addMonths, addDays, prevRange } from '../utils/period'
import { catMeta } from '../types'
import { transactionsApi } from '../api/transactions'
import type { Transaction, CategorySummary } from '../types'

// ── periodi ──────────────────────────────────────────────────────────────────

type PeriodKey = 'mese' | '3m' | '6m' | 'anno'

const PERIODS: { key: PeriodKey; label: string; granularity: 'day' | 'month' }[] = [
  { key: 'mese', label: 'Questo mese', granularity: 'day' },
  { key: '3m', label: 'Ultimi 3 mesi', granularity: 'day' },
  { key: '6m', label: 'Ultimi 6 mesi', granularity: 'day' },
  { key: 'anno', label: "Quest'anno", granularity: 'month' },
]

function getRange(key: PeriodKey): { from: string; to: string; label: string } {
  const end = new Date()
  let start: Date
  let label: string
  if (key === 'mese') {
    start = new Date(end.getFullYear(), end.getMonth(), 1)
    label = end.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  } else if (key === '3m') {
    start = addDays(addMonths(end, -3), 1)
    label = 'Ultimi 3 mesi'
  } else if (key === '6m') {
    start = addDays(addMonths(end, -6), 1)
    label = 'Ultimi 6 mesi'
  } else {
    start = new Date(end.getFullYear(), 0, 1)
    label = String(end.getFullYear())
  }
  return { from: iso(start), to: iso(end), label }
}

// ── sotto-componenti ───────────────────────────────────────────────────────────

function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return null
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return <span className="kpi-delta flat">—</span>
  const up = pct > 0
  const good = invert ? !up : up
  return (
    <span className={'kpi-delta ' + (good ? 'good' : 'bad')}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} stroke={2.2} />
      {Math.abs(pct).toFixed(1).replace('.', ',')}%
    </span>
  )
}

function Kpi({
  label,
  value,
  prev,
  color,
  invert,
  big,
}: {
  label: string
  value: number
  prev: number
  color?: string
  invert?: boolean
  big?: boolean
}) {
  const v = useCountUp(value, [value])
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <Delta cur={value} prev={prev} invert={invert} />
      </div>
      <div className={'kpi-value' + (big ? ' hero' : '')} style={color ? { color } : undefined}>
        {formatEUR(v, { plus: big && value > 0 })}
      </div>
    </div>
  )
}

function CatBreakdown({
  cats,
  total,
  activeCat,
  pinnedCats,
  onSelect,
  onPin,
}: {
  cats: { c: CategorySummary; val: number }[]
  total: number
  activeCat: string | null
  pinnedCats: string[]
  onSelect: (name: string) => void
  onPin: (name: string) => void
}) {
  const max = cats[0]?.val || 1
  if (!cats.length) {
    return <p className="text-sm text-[var(--text-3)] py-4">Nessuna spesa nel periodo.</p>
  }
  return (
    <div className="catlist">
      {cats.map(({ c, val }) => {
        const { color } = catMeta(c.category)
        const pct = total ? (val / total) * 100 : 0
        const isActive = c.category === activeCat
        const isPinned = pinnedCats.includes(c.category)
        return (
          <button
            className={'catrow' + (isActive || isPinned ? ' catrow-on' : '')}
            key={c.category}
            style={isActive || isPinned ? { background: color + '12', borderRadius: 10 } : undefined}
            onClick={() => onSelect(c.category)}
          >
            <div className="catrow-head">
              <CatGlyph category={c.category} size={26} />
              <span className="catrow-name">{c.category}</span>
              <span className="catrow-amt">{formatEUR(val)}</span>
              <span
                role="button"
                title={isPinned ? 'Rimuovi dal confronto' : 'Fissa nel grafico'}
                onClick={(e) => { e.stopPropagation(); onPin(c.category) }}
                style={{
                  marginLeft: 4,
                  opacity: isPinned ? 1 : 0.3,
                  color: isPinned ? color : 'var(--text-2)',
                  transition: '0.14s',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Icon name="pin" size={14} stroke={isPinned ? 2.2 : 1.6} />
              </span>
            </div>
            <div className="catrow-track">
              <div
                className="catrow-fill"
                style={{ width: Math.max(3, (val / max) * 100) + '%', background: color }}
              />
            </div>
            <div className="catrow-meta">
              <span className="catrow-pct">{pct.toFixed(0)}% del totale</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function RecentList({
  list,
  onPick,
}: {
  list: Transaction[]
  onPick: (t: Transaction) => void
}) {
  if (!list.length) {
    return <p className="text-sm text-[var(--text-3)] py-4">Nessuna transazione nel periodo.</p>
  }
  return (
    <div className="txlist d-comoda">
      {list.map((t) => {
        const { color } = catMeta(t.category)
        const inc = t.amount > 0
        const d = new Date(t.date + 'T12:00:00')
        return (
          <button className="txrow" key={t.id} onClick={() => onPick(t)}>
            <CatGlyph category={t.category} size={34} />
            <div className="txrow-main">
              <span className="txrow-desc">{t.description}</span>
              <span className="txrow-sub">
                <span className="txrow-cat" style={{ color }}>
                  {t.category}
                </span>
                <span className="dot">·</span>
                {t.source === 'manuale' ? 'Manuale' : 'Import'}
              </span>
            </div>
            <div className="txrow-right">
              <span className={'txrow-amt ' + (inc ? 'in' : 'out')}>
                {formatEUR(t.amount, { plus: inc })}
              </span>
              <span className="txrow-date">
                {d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── pagina ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [period, setPeriod] = useState<PeriodKey>('3m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(today())
  const [drawerTx, setDrawerTx] = useState<Transaction | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [pinnedCats, setPinnedCats] = useState<string[]>([])
  const [showAllCats, setShowAllCats] = useState(true)
  const { toast } = useToast()

  const range = getRange(period)
  const from = customFrom || range.from
  const to   = customTo   || range.to
  const { label } = range
  const gran = 'day' as const
  const prev = prevRange(from, to)

  const { data: summary, isLoading: loadingSummary } = useSummary(from, to)
  const { data: prevSummary } = useSummary(prev.from, prev.to)
  const { data: timeline, isLoading: loadingTimeline } = useTimeline(from, to, gran)
  const { data: recentData } = useTransactions({ from, to, limit: 8, offset: 0 })

  const spese = summary?.spese_totali ?? 0
  const entrate = summary?.entrate_totali ?? 0
  const netto = entrate - spese
  const prevSpese = prevSummary?.spese_totali ?? 0
  const prevEntrate = prevSummary?.entrate_totali ?? 0
  const prevNetto = prevEntrate - prevSpese

  const endBalance =
    timeline?.data?.at(-1)?.saldo_cumulativo ?? timeline?.saldo_iniziale ?? 0

  const cats = useMemo(() => {
    const list = (summary?.per_categoria ?? [])
      .filter((c) => c.spese > 0)
      .map((c) => ({ c, val: c.spese }))
      .sort((a, b) => b.val - a.val)
    return list
  }, [summary])

  const recent = useMemo(() => {
    const list = [...(recentData?.data ?? [])]
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return list.slice(0, 8)
  }, [recentData])

  // bar chart granularity: weekly up to 6 months, monthly beyond
  const rangeDays = useMemo(() => {
    try {
      return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000)
    } catch { return 90 }
  }, [from, to])
  const barGran: 'week' | 'month' = rangeDays > 270 ? 'month' : 'week'

  // Categories to show in spending chart: pinned + active preview (if not pinned)
  const chartCats = useMemo(() => {
    const all = [...pinnedCats]
    if (activeCat && !pinnedCats.includes(activeCat)) all.push(activeCat)
    return all
  }, [pinnedCats, activeCat])

  // All-categories spending queries (when showAllCats is active)
  const allCatSpendingQueries = useQueries({
    queries: cats.map(({ c }) => ({
      queryKey: ['spending', from, to, barGran, c.category],
      queryFn: () => transactionsApi.timeline(from, to, barGran, c.category),
      enabled: showAllCats,
    })),
  })

  // Per-category spending queries (selected/pinned mode)
  const spendingCatQueries = useQueries({
    queries: chartCats.map((cat) => ({
      queryKey: ['spending', from, to, barGran, cat],
      queryFn: () => transactionsApi.timeline(from, to, barGran, cat),
      enabled: !showAllCats,
    })),
  })

  const spendingSeries: SpendingSeries[] = useMemo(() => {
    if (showAllCats) {
      return cats
        .map(({ c }, i) => ({
          name: c.category,
          color: catMeta(c.category).color,
          data: (allCatSpendingQueries[i]?.data?.data ?? []).map(p => ({ date: p.date, amount: p.saldo_cumulativo })),
        }))
        .filter(s => s.data.length > 0)
    }
    if (chartCats.length > 0) {
      return chartCats.map((cat, i) => ({
        name: cat,
        color: catMeta(cat).color,
        data: (spendingCatQueries[i]?.data?.data ?? []).map(p => ({ date: p.date, amount: p.saldo_cumulativo })),
      }))
    }
    return []
  }, [showAllCats, cats, chartCats, allCatSpendingQueries, spendingCatQueries])

  const handleSelectCat = (name: string) => {
    setShowAllCats(false)
    setActiveCat((prev) => (prev === name && !pinnedCats.includes(name) ? null : name))
  }

  const handlePinCat = (name: string) => {
    setShowAllCats(false)
    setPinnedCats((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    )
  }

  const resetToAllCats = () => {
    setShowAllCats(true)
    setActiveCat(null)
    setPinnedCats([])
  }

  return (
    <>
      <main className="content anim-fade">
        {/* topbar */}
        <header className="topbar">
          <div>
            <h1 className="page-title">Panoramica</h1>
            <p className="page-sub" style={{ textTransform: 'capitalize' }}>
              {label}
            </p>
          </div>
          <div className="topbar-r">
            <button className="iconbtn" onClick={() => toast('Notifiche — in arrivo', 'info')}>
              <Icon name="bell" size={18} />
            </button>
          </div>
        </header>

        {/* period pills + date pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div className="periodbar" style={{ margin: 0, flex: '0 0 auto' }} role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key}
                className={'pill' + (period === p.key ? ' on' : '')}
                onClick={() => { setPeriod(p.key); setCustomFrom('') }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto' }} />
          <input
            className="field"
            type="date"
            style={{ width: 140 }}
            value={customFrom || range.from}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <input
            className="field"
            type="date"
            style={{ width: 140 }}
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
        </div>

        {loadingSummary ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            {/* KPI */}
            <section className="kpis">
              <Kpi label="Spese totali" value={spese} prev={prevSpese} invert />
              <Kpi label="Entrate totali" value={entrate} prev={prevEntrate} />
              <Kpi
                label="Saldo netto"
                value={netto}
                prev={prevNetto}
                color={netto >= 0 ? 'var(--in)' : 'var(--out)'}
                big
              />
            </section>

            {/* chart + breakdown */}
            <section className="grid2">
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-head" style={{ alignItems: 'flex-start' }}>
                  <span className="card-eyebrow">Andamento saldo</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                      Saldo attuale
                    </div>
                    <div
                      className="card-balance"
                      style={{ marginTop: 2, fontSize: 30, fontWeight: 700, color: 'var(--accent)' }}
                    >
                      {formatEUR(endBalance)}
                    </div>
                  </div>
                </div>
                {loadingTimeline ? (
                  <div className="flex justify-center py-16">
                    <Spinner />
                  </div>
                ) : (
                  <SaldoChart
                    series={timeline?.data ?? []}
                    height={240}
                    fmt={(v) => formatEUR(v)}
                  />
                )}

                <div style={{ height: 1, background: 'var(--line-2)', margin: '28px -20px 0' }} />
                <div className="card-head" style={{ marginTop: 20 }}>
                  <div>
                    <span className="card-eyebrow">
                      Spese {barGran === 'month' ? 'mensili' : 'settimanali'}
                    </span>
                    {!showAllCats && chartCats.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {spendingSeries.map(s => (
                          <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: s.color, fontWeight: 600 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!showAllCats && (
                    <button
                      className="btn-soft"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={resetToAllCats}
                    >
                      Azzera
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: 180, display: 'flex' }}>
                  <SpendingBars
                    series={spendingSeries}
                    fmt={(v) => formatEUR(v)}
                    granularity={barGran}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <span className="card-eyebrow">Spese per categoria</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className={'pill' + (showAllCats ? ' on' : '')}
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={resetToAllCats}
                    >
                      Tutte
                    </button>
                    <span className="card-note">{formatEUR(spese)}</span>
                  </div>
                </div>
                <CatBreakdown
                  cats={cats}
                  total={spese}
                  activeCat={activeCat}
                  pinnedCats={pinnedCats}
                  onSelect={handleSelectCat}
                  onPin={handlePinCat}
                />
              </div>
            </section>

            {/* recent */}
            <section className="card">
              <div className="card-head">
                <span className="card-eyebrow">Ultime transazioni</span>
                <button className="link" onClick={() => toast('Vai a Transazioni', 'info')}>
                  Vedi tutte <Icon name="chevRight" size={14} stroke={2.2} />
                </button>
              </div>
              <RecentList list={recent} onPick={setDrawerTx} />
            </section>
          </>
        )}
      </main>

      {/* FAB */}
      <button className="fab" aria-label="Aggiungi" onClick={() => setShowCreate(true)}>
        <Icon name="plus" size={22} stroke={2.2} />
      </button>

      {drawerTx && <EditDrawer transaction={drawerTx} onClose={() => setDrawerTx(null)} />}
      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} />}
    </>
  )
}
