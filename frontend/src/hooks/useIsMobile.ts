import { useState, useEffect } from 'react'

/** Breakpoint telefono: deve combaciare con `@media (max-width: 640px)` in index.css. */
export const MOBILE_QUERY = '(max-width: 640px)'

/** True quando il viewport è in fascia "telefono". Usato per i rami JSX
 *  strutturalmente diversi su mobile (il desktop resta invariato). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
