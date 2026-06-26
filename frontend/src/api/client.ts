import { supabase } from '../utils/supabase'

export const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  // Fallire subito e in modo chiaro invece di fetch verso "undefined/..."
  throw new Error('VITE_API_URL non configurata: controlla il file .env del frontend')
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Non autenticato')
  return { Authorization: `Bearer ${token}` }
}

/** Estrae il payload JSON se presente; per errori produce un messaggio leggibile
 *  anche quando il server risponde con HTML/testo (es. 502 da un proxy). */
async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    if (!res.ok) throw new Error(`Errore del server (HTTP ${res.status})`)
    throw new Error('Risposta del server non valida')
  }

  if (!res.ok) {
    const detail = (data as { detail?: unknown })?.detail
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
  }
  return data as T
}

async function handleUnauthorized(): Promise<never> {
  await supabase.auth.signOut()
  window.location.replace('/login')
  throw new Error('Sessione scaduta')
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...options?.headers,
    },
  })
  if (res.status === 401) return handleUnauthorized()
  return parseResponse<T>(res)
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authHeader(),
    body: formData,
  })
  if (res.status === 401) return handleUnauthorized()
  return parseResponse<T>(res)
}
