import { useRef, useState, useMemo, useLayoutEffect } from 'react'
import type { TimelinePoint } from '../../types'

export interface ChartSeries {
  name: string
  color: string
  data: TimelinePoint[]
}

interface Props {
  series: TimelinePoint[]
  color?: string
  height?: number
  mode?: 'curve' | 'bars'
  fmt?: (v: number) => string
  locale?: string
  multiSeries?: ChartSeries[]
}

interface Pt {
  x: number
  y: number
  date: string
  value: number
}

function smoothD(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const t = 0.16
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export function SaldoChart({
  series,
  color = '#57D9B0',
  height = 260,
  mode = 'curve',
  fmt,
  locale = 'it-IT',
  multiSeries,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  const [hover, setHover] = useState<number | null>(null)
  const H = height
  const padT = 18
  const padB = 30
  const padL = 6
  const padR = 6

  const isMulti = !!multiSeries && multiSeries.length > 0

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((e) => setW(Math.round(e[0].contentRect.width)))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Unified geometry for both modes
  const geom = useMemo(() => {
    const innerW = Math.max(10, w - padL - padR)
    const innerH = H - padT - padB

    if (isMulti && multiSeries) {
      // Merge all dates across series
      const dateSet = new Set<string>()
      multiSeries.forEach(s => s.data.forEach(p => dateSet.add(p.date)))
      const dates = Array.from(dateSet).sort()

      const allVals = multiSeries.flatMap(s => s.data.map(p => p.saldo_cumulativo))
      let min = Math.min(0, ...allVals)
      let max = Math.max(1, ...allVals)
      const span = max - min || 1
      min -= span * 0.05
      max += span * 0.12

      const xFn = (i: number) =>
        padL + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW)
      const yFn = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH

      const seriesPts: Pt[][] = multiSeries.map(s => {
        const map = new Map(s.data.map(p => [p.date, p.saldo_cumulativo]))
        return dates.map((date, i) => ({
          x: xFn(i),
          y: yFn(map.get(date) ?? 0),
          date,
          value: map.get(date) ?? 0,
        }))
      })

      return { pts: seriesPts[0] ?? [], seriesPts, dates, innerW, innerH }
    }

    // Single series
    const vals = series.map((s) => s.saldo_cumulativo)
    let min = Math.min(...vals)
    let max = Math.max(...vals)
    const span = max - min || 1
    min -= span * 0.14
    max += span * 0.14
    const xFn = (i: number) =>
      padL + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
    const yFn = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH
    const pts: Pt[] = series.map((s, i) => ({
      x: xFn(i),
      y: yFn(s.saldo_cumulativo),
      date: s.date,
      value: s.saldo_cumulativo,
    }))
    return { pts, seriesPts: null, dates: null, innerW, innerH }
  }, [series, multiSeries, w, H, isMulti])

  const ticks = useMemo(() => {
    const src = isMulti ? (geom.dates ?? []) : series.map(s => s.date)
    if (!src.length) return []

    // "YYYY-MM" (monthly granularity) → "YYYY-MM-01" so Date parsing is valid
    const norm = src.map(d => d.length === 7 ? d + '-01' : d)

    const firstMs = new Date(norm[0] + 'T00:00:00').getTime()
    const lastMs  = new Date(norm[norm.length - 1] + 'T00:00:00').getTime()
    const rangeDays = Math.max(1, (lastMs - firstMs) / 86400000)

    const out: { i: number; label: string }[] = []

    if (rangeDays > 300) {
      // Monthly labels — one tick per month
      let lastM = -1
      norm.forEach((d, i) => {
        const dt = new Date(d + 'T00:00:00')
        if (dt.getMonth() !== lastM) {
          lastM = dt.getMonth()
          out.push({ i, label: dt.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toUpperCase() })
        }
      })
    } else {
      // Weekly labels: generate evenly-spaced target dates, snap each to nearest data point
      const weekMs = 7 * 86400000
      const totalWeeks = Math.ceil(rangeDays / 7)
      const everyN = Math.max(1, Math.ceil(totalWeeks / 10))
      const seen = new Set<number>()

      for (let w = 0; w <= totalWeeks; w += everyN) {
        const target = firstMs + w * weekMs
        let bestIdx = 0
        let bestDiff = Infinity
        norm.forEach((d, i) => {
          const diff = Math.abs(new Date(d + 'T00:00:00').getTime() - target)
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
        })
        if (!seen.has(bestIdx)) {
          seen.add(bestIdx)
          const dt = new Date(norm[bestIdx] + 'T00:00:00')
          const label = dt.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '').toLowerCase()
          out.push({ i: bestIdx, label })
        }
      }
    }

    return out
  }, [series, geom.dates, isMulti, locale])

  const imgSrc = useMemo(() => {
    const base = H - padB
    const grid = [0.25, 0.5, 0.75]
      .map((g) => {
        const yy = (padT + geom.innerH * g).toFixed(1)
        return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`
      })
      .join('')

    const ptsForTicks = isMulti ? geom.pts : geom.pts
    const tk = ticks
      .map((t) => {
        const p = ptsForTicks[t.i]
        return p
          ? `<text x="${p.x.toFixed(1)}" y="${H - 10}" fill="rgba(255,255,255,0.42)" font-size="11" font-family="system-ui" font-weight="600" text-anchor="middle" letter-spacing="0.5">${t.label}</text>`
          : ''
      })
      .join('')

    let body: string
    if (isMulti && multiSeries && geom.seriesPts) {
      body = geom.seriesPts.map((pts, si) => {
        if (!pts.length) return ''
        const c = multiSeries[si].color
        const d = smoothD(pts)
        return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" opacity="0.9"/>`
      }).join('')
    } else if (mode === 'bars') {
      const pts = geom.pts
      if (!pts.length) return ''
      const bw = Math.max(1.5, geom.innerW / series.length - 1.6)
      body = pts
        .map(
          (p) =>
            `<rect x="${(p.x - bw / 2).toFixed(1)}" y="${p.y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, base - p.y).toFixed(1)}" rx="${Math.min(2, bw / 2).toFixed(1)}" fill="${color}" fill-opacity="0.55"/>`
        )
        .join('')
    } else {
      const pts = geom.pts
      if (!pts.length) return ''
      const d = smoothD(pts)
      const area = `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`
      body = `<path d="${area}" fill="url(#g)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>`
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.34"/><stop offset="55%" stop-color="${color}" stop-opacity="0.08"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}${body}${tk}</svg>`
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
  }, [geom, w, H, color, mode, ticks, series.length, isMulti, multiSeries])

  function onMove(e: React.MouseEvent) {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    let best = 0
    let bd = Infinity
    geom.pts.forEach((p, i) => {
      const d = Math.abs(p.x - mx)
      if (d < bd) { bd = d; best = i }
    })
    setHover(best)
  }

  const hp = hover != null ? geom.pts[hover] : null
  const isEmpty = isMulti
    ? (multiSeries?.every(s => !s.data.length) ?? true)
    : !series.length

  if (isEmpty) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-sm text-[var(--text-3)]">
        Nessun dato disponibile
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', height: H }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {imgSrc && (
        <img
          src={imgSrc}
          draggable={false}
          style={{ display: 'block', width: '100%', height: H, userSelect: 'none' }}
          alt="Grafico"
        />
      )}

      {/* Crosshair line */}
      {hp && (
        <div
          style={{
            position: 'absolute',
            left: hp.x,
            top: padT - 6,
            height: H - padB - (padT - 6),
            width: 1,
            borderLeft: '1px dashed rgba(255,255,255,0.28)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Dots: multi-series = one dot per series, single = one dot */}
      {hp && !isMulti && mode !== 'bars' && (
        <div
          style={{
            position: 'absolute',
            left: hp.x - 6,
            top: hp.y - 6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: color,
            boxShadow: '0 0 0 2.5px #0B0D10',
            pointerEvents: 'none',
          }}
        />
      )}
      {hp && isMulti && multiSeries && geom.seriesPts && geom.seriesPts.map((pts, si) => {
        const dot = pts[hover!]
        if (!dot) return null
        return (
          <div
            key={si}
            style={{
              position: 'absolute',
              left: dot.x - 5,
              top: dot.y - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: multiSeries[si].color,
              boxShadow: '0 0 0 2px #0B0D10',
              pointerEvents: 'none',
            }}
          />
        )
      })}

      {/* Tooltip */}
      {hp && (
        <div
          style={{
            position: 'absolute',
            top: padT - 4,
            pointerEvents: 'none',
            left: Math.max(4, Math.min(w - 180, hp.x - 80)),
            background: 'rgba(20,23,28,0.96)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '8px 11px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 5, textTransform: 'capitalize' }}>
            {new Date(hp.date + 'T00:00:00').toLocaleDateString(locale, {
              weekday: 'short', day: 'numeric', month: 'long',
            })}
          </div>
          {isMulti && multiSeries && geom.seriesPts
            ? geom.seriesPts.map((pts, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: multiSeries[si].color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ color: multiSeries[si].color, fontSize: 11, minWidth: 70 }}>{multiSeries[si].name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(pts[hover!]?.value ?? 0) : (pts[hover!]?.value ?? 0)}</span>
                </div>
              ))
            : (
              <div style={{ fontSize: 15.5, fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {fmt ? fmt(hp.value) : hp.value}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
