import { apiFetch, apiUpload } from './client'

export interface PreviewResult {
  columns: string[]
  sample: Record<string, string>[]
  raw_rows: Record<string, string>[]
  suggested_profile: SuggestedProfile | null
}

export interface SuggestedProfile {
  bank_name: string
  col_date: string
  col_desc: string
  amount_format: 'single' | 'dare_avere'
  col_amount?: string
  col_dare?: string
  col_avere?: string
}

export interface ImportConfirmBody {
  col_date: string
  col_desc: string
  amount_format: 'single' | 'dare_avere'
  col_amount?: string
  col_dare?: string
  col_avere?: string
  raw_rows: Record<string, string>[]
  bank_name?: string
}

export interface ImportResult {
  imported: number
  skipped_duplicates: number
  uncategorized: number
  errors: number
}

export const importApi = {
  preview: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiUpload<PreviewResult>('/import/preview', fd)
  },

  confirm: (body: ImportConfirmBody) =>
    apiFetch<ImportResult>('/import/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
