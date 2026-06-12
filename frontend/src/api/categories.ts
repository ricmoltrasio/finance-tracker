import { apiFetch } from './client'
import type { Category } from '../types'

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/categories'),
  create: (body: Partial<Category>) =>
    apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Category>) =>
    apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: number) => apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
  recategorizeAll: () =>
    apiFetch<{ updated: number }>('/categories/recategorize-all', { method: 'POST' }),
}
