// Helper condivisi per la gestione di periodi e intervalli date.
// Usati da Overview, Transactions e Budget.

/** Data → stringa ISO 'YYYY-MM-DD' */
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Etichetta "Giugno 2026" (mese capitalizzato + anno) per una data. */
export function monthLabel(d: Date): string {
  const s = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Periodo precedente di pari lunghezza, immediatamente prima di [from, to]. */
export function prevRange(from: string, to: string): { from: string; to: string } {
  const s = new Date(from + 'T12:00:00')
  const e = new Date(to + 'T12:00:00')
  const len = e.getTime() - s.getTime()
  const pEnd = new Date(s.getTime() - 86400000)
  const pStart = new Date(pEnd.getTime() - len)
  return { from: iso(pStart), to: iso(pEnd) }
}

/** Opzioni per il dropdown "Mese…": ultimi `count` mesi (default 13), dal più recente. */
export function lastNMonths(count = 13): { value: string; label: string }[] {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({ value: iso(d).slice(0, 7), label: monthLabel(d) })
  }
  return opts
}

/** Converte 'YYYY-MM' nell'intervallo [from, to] del mese.
 *  Per il mese corrente `to` è oggi (mese incompleto). */
export function monthRange(value: string): { from: string; to: string; isCurrent: boolean } {
  const [y, m] = value.split('-').map(Number)
  const now = new Date()
  const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1
  return {
    from: `${value}-01`,
    to: isCurrent ? iso(now) : iso(new Date(y, m, 0)),
    isCurrent,
  }
}
