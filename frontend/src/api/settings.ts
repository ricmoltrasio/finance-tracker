import { apiFetch } from './client'

export const settingsApi = {
  list: () => apiFetch<Record<string, string>>('/settings'),
  update: (key: string, value: string) =>
    apiFetch<void>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
}
