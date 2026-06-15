/** Estrae un messaggio leggibile da un errore di tipo ignoto (catch). */
export function errorMessage(e: unknown, fallback = 'Si è verificato un errore'): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e) return e
  return fallback
}
