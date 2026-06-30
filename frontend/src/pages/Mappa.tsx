import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { locationsApi } from '../api/locations'
import type { MapPoint } from '../api/locations'
import type { Transaction } from '../types'
import { catMeta } from '../types'
import { Spinner } from '../components/common/Spinner'
import { CatGlyph } from '../components/common/CatGlyph'
import { formatEUR, capitalize } from '../utils/format'
import { isoLocal, addMonths, lastNMonths, monthRange } from '../utils/period'
import { PeriodChip } from '../components/common/PeriodChip'
import type { PeriodOption } from '../components/common/PeriodChip'
import { EditDrawer } from '../components/transactions/TransactionDrawer'

// Fix leaflet default icon path (broken by bundlers)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

type PeriodKey = 'mese' | '3m' | '6m' | '12m' | 'anno'

const PERIODS: PeriodOption[] = [
  { key: 'mese', label: 'Questo mese' },
  { key: '3m', label: 'Ultimi 3 mesi' },
  { key: '6m', label: 'Ultimi 6 mesi' },
  { key: '12m', label: 'Ultimi 12 mesi' },
  { key: 'anno', label: 'Quest’anno' },
]

function getRange(period: PeriodKey): { from: string; to: string } {
  const now = new Date()
  const to = isoLocal(now)
  if (period === 'mese') {
    return { from: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  }
  if (period === 'anno') {
    return { from: isoLocal(new Date(now.getFullYear(), 0, 1)), to }
  }
  const n = period === '3m' ? 3 : period === '6m' ? 6 : 12
  return { from: isoLocal(addMonths(now, -n)), to }
}

export default function Mappa() {
  const [period, setPeriod] = useState<PeriodKey>('3m')
  const [customMonth, setCustomMonth] = useState('')
  const [selected, setSelected] = useState<MapPoint | null>(null)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{ processed: number; enriched: number } | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const monthOptions = lastNMonths()

  const { from, to } = customMonth ? monthRange(customMonth) : getRange(period)

  const { data: points, isLoading } = useQuery({
    queryKey: ['locations-map', from, to],
    queryFn: () => locationsApi.map(from, to),
  })

  async function handleEnrich() {
    setEnriching(true)
    setEnrichResult(null)
    try {
      const res = await locationsApi.enrich()
      setEnrichResult(res)
      qc.invalidateQueries({ queryKey: ['locations-map'] })
    } finally {
      setEnriching(false)
    }
  }

  // Inizializza la mappa una sola volta
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [42.5, 12.5],
      zoom: 6,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Tiene la sidebar allineata dopo un refetch (es. modifica posizione dal drawer)
  useEffect(() => {
    if (!selected || !points) return
    setSelected(points.find((p) => p.city === selected.city) ?? null)
  }, [points])

  // Aggiorna i marker quando i dati cambiano
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
    }

    if (!points?.length) return

    const cluster = L.markerClusterGroup({
      iconCreateFunction: (c: L.MarkerCluster) => {
        const count = c.getChildCount()
        return L.divIcon({
          html: `<div class="map-cluster">${count}</div>`,
          className: '',
          iconSize: [44, 44],
        })
      },
    })

    for (const pt of points) {
      const marker = L.marker([pt.lat, pt.lng])
      const spese = pt.transactions.filter((t) => t.amount < 0)
      const totaleSpese = spese.reduce((s, t) => s + Math.abs(t.amount), 0)
      marker.bindTooltip(`<strong>${capitalize(pt.city)}</strong><br/>${formatEUR(-totaleSpese)}`, {
        permanent: false,
        direction: 'top',
      })
      marker.on('click', () => setSelected(pt))
      cluster.addLayer(marker)
    }

    map.addLayer(cluster)
    clusterRef.current = cluster
  }, [points])

  const speseCitta = selected
    ? selected.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    : 0

  return (
    <main className="content mappa-content mappa-page anim-fade">
      {/* header */}
      <div className="mappa-header">
        <h1 className="page-title" style={{ margin: 0 }}>Mappa</h1>
        <PeriodChip
          options={PERIODS}
          value={period}
          onChange={(k) => { setPeriod(k as PeriodKey); setCustomMonth(''); setSelected(null) }}
        />
        <select
          className={'pill-select' + (customMonth ? ' on' : '')}
          value={customMonth}
          onChange={(e) => { setCustomMonth(e.target.value); setSelected(null) }}
        >
          <option value="">Mese…</option>
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          className="btn-soft"
          style={{ marginLeft: 'auto', fontSize: 13 }}
          onClick={handleEnrich}
          disabled={enriching}
        >
          {enriching ? <><Spinner className="h-3 w-3" /> Arricchimento…</> : '📍 Arricchisci posizioni'}
        </button>
        {enrichResult && (
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {enrichResult.enriched} nuove su {enrichResult.processed} descrizioni
          </span>
        )}
      </div>

      {/* corpo */}
      <div className="mappa-body">
        {/* mappa */}
        <div className="mappa-map-wrap">
          {isLoading && (
            <div className="mappa-loading">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          <div ref={containerRef} className="mappa-canvas" />
          {!isLoading && points?.length === 0 && (
            <div className="mappa-empty">
              Nessuna transazione geolocalizzata nel periodo.<br />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Importa un file con la colonna "Luogo" per abilitare la mappa.
              </span>
            </div>
          )}
        </div>

        {/* sidebar città selezionata / dettaglio transazione */}
        {editTx ? (
          <EditDrawer transaction={editTx} onClose={() => setEditTx(null)} variant="embedded" />
        ) : selected && (
          <div className="mappa-sidebar">
            <div className="mappa-sidebar-header">
              <span className="mappa-sidebar-city">📍 {capitalize(selected.city)}</span>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="chiudi">✕</button>
            </div>
            <div className="mappa-sidebar-stats">
              <span>{selected.count} transazioni</span>
              <span style={{ color: 'var(--red)' }}>{formatEUR(-speseCitta)}</span>
            </div>
            <div className="mappa-sidebar-list">
              {selected.transactions
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => (
                  <button
                    key={t.id}
                    className="mappa-tx-row"
                    onClick={() => setEditTx(t)}
                  >
                    <CatGlyph category={t.category} size={30} />
                    <div className="mappa-tx-info">
                      <div className="mappa-tx-desc">{t.description}</div>
                      <div className="mappa-tx-meta">
                        {formatDate(t.date)} ·{' '}
                        <span style={{ color: catMeta(t.category).color }}>{t.category}</span>
                      </div>
                    </div>
                    <span className={t.amount < 0 ? 'mappa-tx-out' : 'mappa-tx-in'}>
                      {formatEUR(t.amount, { plus: t.amount > 0 })}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}
