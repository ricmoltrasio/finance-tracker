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

export interface SetLocationResult {
  updated: number
  transactions: Transaction[]
}

export type QueryParams = Record<string, string | number | string[] | undefined>

/** Costruisce la query string; gli array diventano parametri ripetuti
 *  (?descriptions=A&descriptions=B — le descrizioni possono contenere virgole). */
function qs(params: QueryParams): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) {
      for (const item of v) p.append(k, item)
    } else {
      p.set(k, String(v))
    }
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export interface SummaryExtra {
  category?: string
  search?: string
  descriptions?: string[]
}

export const transactionsApi = {
  list: (params: QueryParams) =>
    apiFetch<TransactionListResponse>(`/transactions${qs(params)}`),

  summary: (from?: string, to?: string, extra?: SummaryExtra) =>
    apiFetch<Summary>(`/transactions/summary${qs({ from, to, ...extra })}`),

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

  setLocation: (id: number, city: string, onlyThis = false, dryRun = false, ids?: number[]) =>
    apiFetch<SetLocationResult>(`/transactions/${id}/location?dry_run=${dryRun}`, {
      method: 'PUT',
      body: JSON.stringify({ city, only_this: onlyThis, ids }),
    }),

  split: (id: number, items: { category: string; amount: number; note: string }[]) =>
    apiFetch<void>(`/transactions/${id}/split`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
}
