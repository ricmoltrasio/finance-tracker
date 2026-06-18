import { useRef, useState, useMemo, useLayoutEffect } from 'react'

export interface SpendingSeries {
  name: string
  color: string
  data: { date: string; amount: number }[]
}

interface Props {
  series: SpendingSeries[]
  height?: number
  fmt?: (v: number) => string
  locale?: string
  granularity?: 'week' | 'month'
}

export function SpendingBars({ series, height = 220, fmt, locale = 'it-IT', granularity = 'week' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  const [measuredH, setMeasuredH] = useState(height)
  const [hover, setHover] = useState<number | null>(null)
  const [tipX, setTipX] = useState(0)
  const [tipY, setTipY] = useState(0)
  const [tipChartY, setTipChartY] = useState(0)
  // Altezza effettiva: riempie il contenitore (height: 100%) auto-misurandosi.
  const H = Math.max(140, measuredH)
  const padT = 10
  const padB = 26
  const padL = 6
  const padR = 6

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(e => {
      setW(Math.round(e[0].contentRect.width))
      setMeasuredH(Math.round(e[0].contentRect.height))
    })
    ro.observe(el)
    setW(el.clientWidth)
    setMeasuredH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const dates = useMemo(() => {
    const s = new Set<string>()
    series.forEach(sr => sr.data.forEach(p => s.add(p.date)))
    return Array.from(s).sort()
  }, [series])

  const seriesMaps = useMemo(() =>
    series.map(sr => new Map(sr.data.map(p => [p.date, p.amount])))
  , [series])

  const matrix = useMemo(() =>
    dates.map(d => {
      const amounts = series.map((_, si) => seriesMaps[si].get(d) ?? 0)
      return { date: d, amounts, total: amounts.reduce((a, b) => a + b, 0) }
    })
  , [dates, series, seriesMaps])

  const maxTotal = useMemo(() => Math.max(1, ...matrix.map(m => m.total)), [matrix])

  const innerW = Math.max(10, w - padL - padR)
  const innerH = H - padT - padB
  const n = dates.length
  const barStep = n > 0 ? innerW / n : innerW
  const barW = Math.max(2, barStep * 0.65)

  const ticks = useMemo(() => {
    if (!n) return []
    const norm = dates.map(d => d.length === 7 ? d + '-01' : d)
    const everyN = Math.max(1, Math.ceil(n / 10))
    return norm.flatMap((d, i) => {
      if (i % everyN !== 0 && i !== n - 1) return []
      const dt = new Date(d + 'T00:00:00')
      const label = granularity === 'month'
        ? dt.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase()
        : dt.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '').toLowerCase()
      return [{ i, label }]
    })
  }, [dates, n, granularity, locale])

  const imgSrc = useMemo(() => {
    if (!n) return ''

    const grid = [0.25, 0.5, 0.75, 1.0].map(g => {
      const yy = (padT + innerH * (1 - g)).toFixed(1)
      return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`
    }).join('')

    const hl = hover !== null ? (() => {
      const cx = padL + (hover + 0.5) * barStep
      return `<rect x="${(cx - barW / 2 - 2).toFixed(1)}" y="${padT}" width="${(barW + 4).toFixed(1)}" height="${innerH}" rx="2" fill="rgba(255,255,255,0.06)"/>`
    })() : ''

    const bars = matrix.map((m, i) => {
      const cx = padL + (i + 0.5) * barStep
      const x = cx - barW / 2
      const rx = Math.min(2, barW / 3).toFixed(1)
      let yBottom = padT + innerH
      return series.map((sr, si) => {
        const amt = m.amounts[si]
        if (!amt) return ''
        const bh = Math.max(0, (amt / maxTotal) * innerH)
        yBottom -= bh
        return `<rect x="${x.toFixed(1)}" y="${yBottom.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${rx}" fill="${sr.color}" fill-opacity="0.8"/>`
      }).join('')
    }).join('')

    const labels = ticks.map(t => {
      const cx = padL + (t.i + 0.5) * barStep
      return `<text x="${cx.toFixed(1)}" y="${H - 10}" fill="rgba(255,255,255,0.42)" font-size="11" font-family="system-ui" font-weight="600" text-anchor="middle" letter-spacing="0.5">${t.label}</text>`
    }).join('')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${grid}${hl}${bars}${labels}</svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }, [matrix, hover, w, H, barStep, barW, innerH, padT, padL, padR, series, maxTotal, ticks, n])

  function onPickBar(clientX: number, clientY: number) {
    if (!wrapRef.current || n === 0) return
    const rect = wrapRef.current.getBoundingClientRect()
    const actualStep = n > 0 ? Math.max(10, rect.width - padL - padR) / n : 1
    const mx = clientX - rect.left
    const idx = Math.max(0, Math.min(n - 1, Math.floor((mx - padL) / actualStep)))
    setHover(idx)
    setTipX(clientX)
    setTipY(clientY)
    setTipChartY(rect.top)
  }

  function onMove(e: React.MouseEvent) { onPickBar(e.clientX, e.clientY) }
  function onTouch(e: React.TouchEvent) { e.preventDefault(); onPickBar(e.touches[0].clientX, e.touches[0].clientY) }

  if (!series.length || series.every(s => !s.data.length)) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-sm text-[var(--text-3)]">
        Nessun dato disponibile
      </div>
    )
  }

  const hp = hover !== null ? matrix[hover] : null

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 140 }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      onTouchEnd={() => setHover(null)}
    >
      {imgSrc && (
        <img src={imgSrc} draggable={false}
          style={{ display: 'block', width: '100%', height: H, userSelect: 'none' }}
          alt="Spese" />
      )}

      {hp && (
        <div style={{
          position: 'fixed',
          top: Math.max(tipChartY + padT + 4, tipY - 130),
          left: Math.max(4, Math.min(window.innerWidth - 188, tipX - 94)),
          zIndex: 9999,
          background: 'rgba(20,23,28,0.96)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10,
          padding: '8px 11px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          minWidth: 150,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'capitalize' }}>
            {(() => {
              const raw = hp.date.length === 7 ? hp.date + '-01' : hp.date
              const dt = new Date(raw + 'T00:00:00')
              return granularity === 'month'
                ? dt.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                : `Sett. del ${dt.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}`
            })()}
          </div>
          {series.map((sr, si) => hp.amounts[si] > 0 && (
            <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sr.color, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: sr.color, fontSize: 11, minWidth: 70 }}>{sr.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(hp.amounts[si]) : hp.amounts[si]}</span>
            </div>
          ))}
          {series.length > 1 && hp.total > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)', fontVariantNumeric: 'tabular-nums' }}>
              Totale: {fmt ? fmt(hp.total) : hp.total}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
