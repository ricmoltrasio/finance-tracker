import { Skeleton } from '../common/Skeleton'

/** Righe a forma di .mgroup-head, per il primo caricamento della vista "raggruppa esercenti". */
export function MerchantGroupSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mgroup-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="mgroup-head" key={i} style={{ cursor: 'default' }}>
          <Skeleton style={{ height: 14, width: `${55 - (i % 3) * 10}%` }} />
          <Skeleton style={{ height: 11, width: 22, marginLeft: 'auto', flex: '0 0 auto' }} />
          <Skeleton style={{ height: 14, width: 70, flex: '0 0 auto' }} />
        </div>
      ))}
    </div>
  )
}
