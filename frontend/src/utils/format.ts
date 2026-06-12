export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

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

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  })
}

export function formatMonth(dateStr: string): string {
  return new Date(dateStr + '-01T00:00:00').toLocaleDateString('it-IT', {
    month: 'short',
    year: '2-digit',
  })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function startOfMonth(offsetMonths = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 10)
}

export function startOfYear(): string {
  const d = new Date()
  d.setMonth(0, 1)
  return d.toISOString().slice(0, 10)
}
