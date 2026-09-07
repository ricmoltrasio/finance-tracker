import { Skeleton } from '../common/Skeleton'

/** Righe a forma di .txrow, per lo stato di primo caricamento di liste transazioni. */
export function TxRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="txlist d-comoda">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="txrow" key={i} style={{ cursor: 'default' }}>
          <Skeleton style={{ width: 34, height: 34, borderRadius: '50%', flex: '0 0 auto' }} />
          <div className="txrow-main">
            <Skeleton style={{ height: 14, width: `${60 - (i % 3) * 8}%`, marginBottom: 6 }} />
            <Skeleton style={{ height: 11, width: '35%' }} />
          </div>
          <div className="txrow-right">
            <Skeleton style={{ height: 14, width: 60, marginBottom: 6 }} />
            <Skeleton style={{ height: 11, width: 44 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
