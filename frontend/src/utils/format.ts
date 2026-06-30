/** Stile mockup: "1.234,56 €" — minus tipografico, "+" opzionale, simbolo dopo */
export function formatEUR(
  n: number,
  opts: { plus?: boolean; noSymbol?: boolean } = {}
): string {
  const s = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
  const sign = n < 0 ? '−' : opts.plus ? '+' : ''
  return `${sign}${s}${opts.noSymbol ? '' : ' €'}`
}

/** Data odierna in formato ISO 'YYYY-MM-DD' (ora locale). */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
