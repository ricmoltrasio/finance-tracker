import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Bottom sheet per i flussi mobile. Riusa le classi .drawer/.drawer-scrim che
 *  sotto i 640px sono già ri-stilate come foglio dal basso (vedi index.css).
 *  Da montare solo quando `useIsMobile()` è true. */
export function MobileSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
