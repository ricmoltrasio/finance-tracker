import { supabase } from '../utils/supabase'

export const API_URL = import.meta.env.VITE_API_URL as string

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Non autenticato')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
  return data
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Non autenticato')

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
  return data
}
