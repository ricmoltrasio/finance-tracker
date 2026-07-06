import { apiFetch } from './client'
import type { Transaction } from '../types'

export interface MapPoint {
  city: string
  lat: number
  lng: number
  total_amount: number
  count: number
  transactions: Transaction[]
}

export const locationsApi = {
  map: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return apiFetch<MapPoint[]>(`/locations/map${qs ? '?' + qs : ''}`)
  },

  enrich: () =>
    apiFetch<{ processed: number; enriched: number }>('/locations/enrich', { method: 'POST' }),
}
