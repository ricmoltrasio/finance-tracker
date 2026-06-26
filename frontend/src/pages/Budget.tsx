import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSummary } from '../hooks/useSummary'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { catMeta } from '../types'
import type { Transaction } from '../types'
import { CatGlyph } from '../components/common/CatGlyph'
import { Icon } from '../components/common/Icon'
import { Spinner } from '../components/common/Spinner'
import { TransactionList } from '../components/transactions/TransactionList'
import { EditDrawer } from '../components/transactions/TransactionDrawer'
import { formatEUR } from '../utils/format'
import { iso, addMonths, addDays, monthLabel, lastNMonths } from '../utils/period'
import { useIsMobile } from '../hooks/useIsMobile'
import { PeriodChip } from '../components/common/PeriodChip'

const PROJECTION_CATS = ['Cibo', 'Auto']

const PILLS = [
  { key: 'mese' as const, label: 'Questo mese' },
  { key: '3m'  as const, label: '3 mesi' },
  { key: '6m'  as const, label: '6 mesi' },
  { key: '12m' as const, label: '12 mesi' },
  { key: 'anno' as const, label: 'Anno' },
]

type PillKey = 'mese' | '3m' | '6m' | '12m' | 'anno'

export default function Budget() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  const [activePill, setActivePill] = useState<PillKey>('mese')
  const [customMonth, setCustomMonth] = useState<string>('')
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const isMobile = useIsMobile()

  const monthOptions = useMemo(() => lastNMonths(), [])

  const { fromStr, toStr, periodDisplay, isSingleMonth, showProjection, daysElapsed, daysInMonth, daysRemaining } =
    useMemo(() => {
      const end = new Date()

      if (customMonth) {
        const [y, m] = customMonth.split('-').map(Number)
        const isCurrentM = y === year && m === month + 1
        const dIM = new Date(y, m, 0).getDate()
        const dE = isCurrentM ? end.getDate() : dIM
        return {
          fromStr: `${customMonth}-01`,
          toStr: isCurrentM ? iso(end) : iso(new Date(y, m, 0)),
          periodDisplay: monthLabel(new Date(y, m - 1, 1)),
          isSingleMonth: true,
          showProjection: isCurrentM,
          daysElapsed: dE,
          daysInMonth: dIM,
          daysRemaining: dIM - dE,
        }
      }

      const dIM = new Date(year, month + 1, 0).getDate()
      const dE = end.getDate()

      if (activePill === 'mese') {
        return {
          fromStr: iso(new Date(year, month, 1)),
          toStr: iso(end),
          periodDisplay: monthLabel(end),
          isSingleMonth: true,
          showProjection: true,
          daysElapsed: dE,
          daysInMonth: dIM,
          daysRemaining: dIM - dE,
        }
      }

      if (activePill === '3m')
        return { fromStr: iso(addDays(addMonths(end, -3), 1)), toStr: iso(end), periodDisplay: 'Ultimi 3 mesi', isSingleMonth: false, showProjection: false, daysElapsed: dE, daysInMonth: dIM, daysRemaining: dIM - dE }
      if (activePill === '6m')
        return { fromStr: iso(addDays(addMonths(end, -6), 1)), toStr: iso(end), periodDisplay: 'Ultimi 6 mesi', isSingleMonth: false, showProjection: false, daysElapsed: dE, daysInMonth: dIM, daysRemaining: dIM - dE }
      if (activePill === '12m')
        return { fromStr: iso(addDays(addMonths(end, -12), 1)), toStr: iso(end), periodDisplay: 'Ultimi 12 mesi', isSingleMonth: false, showProjection: false, daysElapsed: dE, daysInMonth: dIM, daysRemaining: dIM - dE }

      // anno
      return {
        fromStr: iso(new Date(year, 0, 1)),
        toStr: iso(end),
        periodDisplay: String(year),
        isSingleMonth: false,
        showProjection: false,
        daysElapsed: dE,
        daysInMonth: dIM,
        daysRemaining: dIM - dE,
      }
    }, [activePill, customMonth, year, month])

  const { data: summary, isLoading: loadingSum } = useSummary(fromStr, toStr)
  const { data: categories, isLoading: loadingCats } = useCategories()

  const spendingMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of summary?.per_categoria ?? []) map[row.category] = row.spese
    return map
  }, [summary])

  const expenseCats = useMemo(() => {
    const cats = (categories ?? []).filter((c) => !c.is_income)
    return cats
      .map((c) => ({ ...c, spent: spendingMap[c.name] ?? 0, hasBudget: (c.budget ?? 0) > 0 }))
      .filter((c) => PROJECTION_CATS.includes(c.name) || c.hasBudget || c.spent > 0)
      .sort((a, b) => {
        const ai = PROJECTION_CATS.indexOf(a.name)
        const bi = PROJECTION_CATS.indexOf(b.name)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1
        if (a.hasBudget && b.hasBudget) return b.spent / b.budget! - a.spent / a.budget!
        return b.spent - a.spent
      })
  }, [categories, spendingMap])

  const isLoading = loadingSum || loadingCats
  const entrate = summary?.entrate_totali ?? 0
  const spese = summary?.spese_totali ?? 0
  const risparmio = entrate - spese
  const noBudgets = expenseCats.every((c) => !c.hasBudget)

  return (
    <main className="content anim-fade">
      <header className="topbar">
        <div>
          <h1 className="page-title">Budget</h1>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0', lineHeight: 1.25 }}>
            {periodDisplay}
          </p>
        </div>
      </header>

      {/* Period selector */}
      {isMobile ? (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PeriodChip
            options={PILLS}
            value={activePill}
            onChange={(k) => { setActivePill(k as PillKey); setCustomMonth('') }}
          />
          <select
            className={'field' + (customMonth ? ' on' : '')}
            value={customMonth}
            onChange={(e) => setCustomMonth(e.target.value)}
          >
            <option value="">Mese specifico…</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="periodbar" style={{ margin: 0, flex: '0 0 auto' }} role="tablist">
            {PILLS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={activePill === p.key && !customMonth}
                className={'pill' + (activePill === p.key && !customMonth ? ' on' : '')}
                onClick={() => { setActivePill(p.key); setCustomMonth('') }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            className={'pill-select' + (customMonth ? ' on' : '')}
            value={customMonth}
            onChange={(e) => setCustomMonth(e.target.value)}
          >
            <option value="">Mese…</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Entrate" value={entrate} color="var(--in)" sign="+" />
            <KpiCard label="Spese" value={spese} color="var(--out)" sign="−" />
            <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
              <KpiCard
                label="Risparmio"
                value={Math.abs(risparmio)}
                color={risparmio >= 0 ? 'var(--in)' : 'var(--out)'}
                sign={risparmio >= 0 ? '+' : '−'}
              />
            </div>
          </div>

          {/* Category cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(400px, 100%), 1fr))', gap: 12 }}>
            {expenseCats.map((cat) => {
              const budget = isSingleMonth && cat.hasBudget ? cat.budget! : null
              const pct = budget ? Math.min(1, cat.spent / budget) : null
              const isOver = budget ? cat.spent > budget : false
              const canProject = showProjection && PROJECTION_CATS.includes(cat.name) && daysElapsed > 0
              const projection = canProject ? (cat.spent / daysElapsed) * daysInMonth : null
              const { color } = catMeta(cat.name)

              const barColor =
                pct == null ? undefined
                : pct >= 1 ? 'var(--out)'
                : pct >= 0.75 ? '#F2A65A'
                : color

              return (
                <div
                  key={cat.id}
                  className="card budget-card"
                  style={{ padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setOpenCat(cat.name)}
                  role="button"
                  title={`Vedi le transazioni di ${cat.name}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CatGlyph category={cat.name} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                          {formatEUR(cat.spent)}
                          {budget && (
                            <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
                              {' '}/ {formatEUR(budget)}
                            </span>
                          )}
                        </span>
                      </div>

                      {budget ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(pct ?? 0) * 100}%`,
                                background: barColor,
                                borderRadius: 3,
                                transition: 'width .4s ease',
                              }}
                            />
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{Math.round((pct ?? 0) * 100)}% usato</span>
                            {isOver
                              ? <span style={{ color: 'var(--out)' }}>+{formatEUR(cat.spent - budget)} sopra</span>
                              : <span>rimangono {formatEUR(budget - cat.spent)}</span>
                            }
                          </div>
                        </div>
                      ) : (
                        isSingleMonth && (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>
                            Nessun budget impostato
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {projection !== null && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 8,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>Proiezione fine mese:</span>
                      <span style={{ fontWeight: 600, color: budget ? (projection > budget ? 'var(--out)' : 'var(--in)') : 'var(--text)' }}>
                        {formatEUR(projection)}
                      </span>
                      {budget && projection > budget && (
                        <span style={{ color: 'var(--out)' }}>(+{formatEUR(projection - budget)})</span>
                      )}
                      {budget && projection <= budget && (
                        <span style={{ color: 'var(--in)' }}>(-{formatEUR(budget - projection)})</span>
                      )}
                      <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 'auto' }}>
                        {daysRemaining}gg rimanenti
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {expenseCats.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                Nessuna spesa registrata nel periodo selezionato.
              </div>
            )}
          </div>

          {noBudgets && expenseCats.length > 0 && (
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
              Imposta i budget mensili dalle{' '}
              <Link to="/settings" style={{ color: 'var(--accent)' }}>Impostazioni</Link>.
            </p>
          )}
        </>
      )}

      {openCat && (
        <CategoryTxDrawer
          category={openCat}
          from={fromStr}
          to={toStr}
          periodLabel={periodDisplay}
          onClose={() => setOpenCat(null)}
          onSelect={(t) => setSelectedTx(t)}
        />
      )}
      {selectedTx && <EditDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />}
    </main>
  )
}

function CategoryTxDrawer({
  category,
  from,
  to,
  periodLabel,
  onClose,
  onSelect,
}: {
  category: string
  from: string
  to: string
  periodLabel: string
  onClose: () => void
  onSelect: (t: Transaction) => void
}) {
  const { data, isLoading } = useTransactions({
    category,
    from,
    to,
    limit: 500,
    sort_by: 'date',
    sort_dir: 'desc',
  })
  const txs = data?.data ?? []
  const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0)

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
      <div className="drawer" role="dialog" aria-modal="true" aria-label={category} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">{category}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <CatGlyph category={category} size={46} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatEUR(total)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {txs.length} {txs.length === 1 ? 'transazione' : 'transazioni'} · {periodLabel}
            </div>
          </div>
        </div>

        <TransactionList transactions={txs} loading={isLoading} onSelect={onSelect} />
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, sign }: { label: string; value: number; color: string; sign: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0, lineHeight: 1.2 }}>
        {sign}{formatEUR(value)}
      </p>
    </div>
  )
}
