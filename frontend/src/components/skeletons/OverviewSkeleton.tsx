import { Skeleton } from '../common/Skeleton'
import { TxRowsSkeleton } from './TxRowsSkeleton'

function CatRowSkeleton({ pct }: { pct: number }) {
  return (
    <div className="catrow" style={{ cursor: 'default' }}>
      <div className="catrow-head">
        <Skeleton style={{ width: 26, height: 26, borderRadius: 8, flex: '0 0 auto' }} />
        <Skeleton style={{ height: 13, width: '40%' }} />
        <Skeleton style={{ height: 13, width: 50, marginLeft: 'auto', flex: '0 0 auto' }} />
      </div>
      <div className="catrow-track">
        <Skeleton style={{ height: '100%', width: `${pct}%`, borderRadius: 999 }} />
      </div>
    </div>
  )
}

/** Stato di primo caricamento della Panoramica: ricalca kpis / grid2 (grafico + categorie) / lista recenti. */
export function OverviewSkeleton() {
  return (
    <>
      <section className="kpis">
        {[0, 1, 2].map((i) => (
          <div className="kpi" key={i}>
            <div className="kpi-top">
              <Skeleton style={{ height: 12, width: 80 }} />
            </div>
            <Skeleton style={{ height: 28, width: '65%' }} />
          </div>
        ))}
      </section>

      <section className="grid2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head" style={{ alignItems: 'flex-start' }}>
            <Skeleton style={{ height: 12, width: 110 }} />
            <Skeleton style={{ height: 26, width: 90 }} />
          </div>
          <Skeleton style={{ height: 240, width: '100%' }} />
          <div style={{ height: 1, background: 'var(--line-2)', margin: '28px -20px 0' }} />
          <div className="card-head" style={{ marginTop: 20 }}>
            <Skeleton style={{ height: 12, width: 130 }} />
          </div>
          <Skeleton style={{ flex: 1, minHeight: 180, width: '100%' }} />
        </div>

        <div className="card">
          <div className="card-head">
            <Skeleton style={{ height: 12, width: 130 }} />
            <Skeleton style={{ height: 12, width: 60 }} />
          </div>
          <div className="catlist">
            {[70, 55, 45, 35, 28, 20].map((pct, i) => (
              <CatRowSkeleton key={i} pct={pct} />
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <Skeleton style={{ height: 12, width: 140 }} />
        </div>
        <TxRowsSkeleton rows={6} />
      </section>
    </>
  )
}
