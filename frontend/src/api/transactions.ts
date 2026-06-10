import { apiFetch } from './client'
import type {
  TransactionCreate,
  TransactionUpdate,
  TransactionListResponse,
  Summary,
  Timeline,
} from '../types'

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString()
  return p ? `?${p}` : ''
}

export const transactionsApi = {
  list: (params: Record<string, string | number | undefined>) =>
    apiFetch<TransactionListResponse>(`/transactions${qs(params)}`),

  summary: (from?: string, to?: string) =>
    apiFetch<Summary>(`/transactions/summary${qs({ from, to })}`),

  timeline: (from?: string, to?: string, granularity = 'day') =>
    apiFetch<Timeline>(`/transactions/timeline${qs({ from, to, granularity })}`),

  create: (body: TransactionCreate) =>
    apiFetch<void>('/transactions', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: TransactionUpdate) =>
    apiFetch<void>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (id: number) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),

  split: (id: number, items: { category: string; amount: number; note: string }[]) =>
    apiFetch<void>(`/transactions/${id}/split`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
}
