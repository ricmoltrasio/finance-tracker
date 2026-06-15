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

/** Data odierna in formato ISO 'YYYY-MM-DD'. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
