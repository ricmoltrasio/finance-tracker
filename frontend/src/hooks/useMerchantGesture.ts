import { useEffect, useRef } from 'react'

const DOUBLE_CLICK_MS = 250
const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10

/** Gesti di selezione esercente su una riga transazione:
 *  - click singolo → `onActivate` (apre il drawer); quando il doppio click è
 *    possibile viene ritardato di ~250 ms per distinguerlo
 *  - doppio click (desktop) → `onToggle`
 *  - pressione prolungata ~500 ms (mobile) → `onToggle`, annullata se il dito
 *    si muove (scroll); il doppio TAP non seleziona
 *
 *  Se `onToggle` è assente il click resta immediato e nessun gesto è attivo:
 *  il comportamento è identico a prima della feature. */
export function useMerchantGesture(onActivate: () => void, onToggle?: () => void) {
  const clickTimer = useRef<number | null>(null)
  const pressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const lastTouchAt = useRef(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
      if (pressTimer.current) window.clearTimeout(pressTimer.current)
    }
  }, [])

  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  return {
    onClick: () => {
      // il click sintetico dopo una pressione prolungata non deve attivare la riga
      if (longPressFired.current) {
        longPressFired.current = false
        return
      }
      if (!onToggle) {
        onActivate()
        return
      }
      if (clickTimer.current) window.clearTimeout(clickTimer.current)
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null
        onActivate()
      }, DOUBLE_CLICK_MS)
    },

    onDoubleClick: () => {
      if (!onToggle) return
      // il doppio TAP su mobile non seleziona (solo long-press)
      if (Date.now() - lastTouchAt.current < 700) return
      if (clickTimer.current) {
        window.clearTimeout(clickTimer.current)
        clickTimer.current = null
      }
      onToggle()
    },

    onTouchStart: (e: React.TouchEvent) => {
      lastTouchAt.current = Date.now()
      if (!onToggle) return
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      cancelPress()
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null
        longPressFired.current = true
        navigator.vibrate?.(15)
        onToggle()
      }, LONG_PRESS_MS)
    },

    onTouchMove: (e: React.TouchEvent) => {
      if (!pressTimer.current || !touchStart.current) return
      const touch = e.touches[0]
      if (
        Math.abs(touch.clientX - touchStart.current.x) > MOVE_TOLERANCE_PX ||
        Math.abs(touch.clientY - touchStart.current.y) > MOVE_TOLERANCE_PX
      ) {
        cancelPress() // il dito sta scrollando
      }
    },

    onTouchEnd: () => {
      lastTouchAt.current = Date.now()
      cancelPress()
    },

    onTouchCancel: () => {
      cancelPress()
    },

    onContextMenu: (e: React.MouseEvent) => {
      // su Android il long-press aprirebbe il context menu
      if (onToggle) e.preventDefault()
    },
  }
}
