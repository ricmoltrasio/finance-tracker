import { Skeleton } from '../common/Skeleton'

function BudgetCardSkeleton({ withBar }: { withBar: boolean }) {
  return (
    <div className="card budget-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton style={{ width: 38, height: 38, borderRadius: 10, flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Skeleton style={{ height: 14, width: '45%' }} />
            <Skeleton style={{ height: 14, width: 60 }} />
          </div>
          {withBar && <Skeleton style={{ height: 6, width: '100%', marginTop: 10, borderRadius: 3 }} />}
        </div>
      </div>
    </div>
  )
}

/** Stato di primo caricamento del Budget: KPI + griglia card categoria (stessa griglia inline di Budget.tsx). */
export function BudgetSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[0, 1, 2].map((i) => (
          <div className="kpi" key={i} style={i === 2 && isMobile ? { gridColumn: '1 / -1' } : undefined}>
            <div className="kpi-top">
              <Skeleton style={{ height: 12, width: 70 }} />
            </div>
            <Skeleton style={{ height: 26, width: '55%' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(400px, 100%), 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <BudgetCardSkeleton key={i} withBar={i % 3 !== 2} />
        ))}
      </div>
    </>
  )
}
