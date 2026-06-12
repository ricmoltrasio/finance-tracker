import { useState, useRef, useEffect } from 'react'

/** Anima un numero da valore precedente a target con ease-out cubico. */
export function useCountUp(target: number, deps: unknown[]): number {
  const [val, setVal] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const start = performance.now()
    const dur = 520
    const a = from.current
    const b = target
    if (a === b) return
    let raf = 0
    let done = false
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(a + (b - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        from.current = b
        done = true
      }
    }
    raf = requestAnimationFrame(tick)
    const safety = setTimeout(() => {
      if (!done) {
        setVal(b)
        from.current = b
      }
    }, dur + 140)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return val
}
