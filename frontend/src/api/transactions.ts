import { apiFetch } from './client'
import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  TransactionListResponse,
  Summary,
  Timeline,
} from '../types'

export interface SetCategoryResult {
  updated: number
  transactions: Transaction[]
}

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

  timeline: (from?: string, to?: string, granularity = 'day', category?: string, spending = false) =>
    apiFetch<Timeline>(`/transactions/timeline${qs({ from, to, granularity, category, spending: spending ? 'true' : undefined })}`),

  create: (body: TransactionCreate) =>
    apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: TransactionUpdate) =>
    apiFetch<void>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (id: number) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),

  listDeleted: () =>
    apiFetch<TransactionListResponse>('/transactions/deleted'),

  restore: (id: number) =>
    apiFetch<Transaction>(`/transactions/${id}/restore`, { method: 'PATCH' }),

  setCategory: (id: number, category: string, onlyThis = false, dryRun = false, ids?: number[]) =>
    apiFetch<SetCategoryResult>(`/transactions/${id}/category?dry_run=${dryRun}`, {
      method: 'PATCH',
      body: JSON.stringify({ category, only_this: onlyThis, ids }),
    }),

  split: (id: number, items: { category: string; amount: number; note: string }[]) =>
    apiFetch<void>(`/transactions/${id}/split`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
}
