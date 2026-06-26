import { apiFetch } from './client'
import type { Category } from '../types'

export interface RecategorizeChange {
  id: number
  description: string
  from_cat: string
  to_cat: string
}

export interface RecategorizeResult {
  updated: number
  changes: RecategorizeChange[]
}

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/categories'),
  create: (body: Partial<Category>) =>
    apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Category>) =>
    apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
  recategorizeAll: (dryRun = false) =>
    apiFetch<RecategorizeResult>(`/categories/recategorize-all?dry_run=${dryRun}`, { method: 'POST' }),
  recategorizeUncategorized: (dryRun = false) =>
    apiFetch<RecategorizeResult>(`/categories/recategorize-uncategorized?dry_run=${dryRun}`, { method: 'POST' }),
}
