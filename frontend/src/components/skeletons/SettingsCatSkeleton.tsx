import { Skeleton } from '../common/Skeleton'

/** Righe a forma di .cat-acc, per il primo caricamento delle categorie in Impostazioni. */
export function SettingsCatSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="cat-grid">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="cat-acc" key={i}>
          <div className="cat-acc-head" style={{ cursor: 'default' }}>
            <Skeleton style={{ width: 34, height: 34, borderRadius: '50%', flex: '0 0 auto' }} />
            <div className="cat-acc-name">
              <Skeleton style={{ height: 14, width: '45%', marginBottom: 6 }} />
              <Skeleton style={{ height: 11, width: '70%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
