export interface Transaction {
  id: number
  date: string
  description: string
  amount: number
  category: string
  source: 'import' | 'manuale'
  note: string
  tags: string[]
  is_split: boolean
}

export interface TransactionCreate {
  date: string
  description: string
  amount: number
  category: string
  source?: 'import' | 'manuale'
  note?: string
  tags?: string[]
}

export interface TransactionUpdate {
  category?: string
  note?: string
  tags?: string[]
}

export interface TransactionListResponse {
  data: Transaction[]
  total: number
}

export interface CategorySummary {
  category: string
  spese: number
  entrate: number
  n: number
}

export interface Summary {
  spese_totali: number
  entrate_totali: number
  per_categoria: CategorySummary[]
}

export interface TimelinePoint {
  date: string
  saldo_cumulativo: number
}

export interface Timeline {
  data: TimelinePoint[]
  saldo_iniziale: number
}

export interface Category {
  id: number
  name: string
  keywords: string[]
  color: string
  icon: string
  budget?: number
  is_income: boolean
}

export const CATEGORIES = [
  'Cibo',
  'Auto',
  'Salute',
  'Intrattenimento',
  'Abbonamenti',
  'Shopping',
  'Teatro e cinema',
  'Spostamenti',
  'Viaggi',
  'Altro',
  'Stipendio',
  'Contanti',
  'Rimborsi',
] as const

export type CategoryName = (typeof CATEGORIES)[number]

export const CATEGORY_COLORS: Record<string, string> = {
  Cibo: '#6CBF8E',
  Auto: '#6C9BCF',
  Salute: '#A78BFA',
  Intrattenimento: '#EF7B7B',
  Abbonamenti: '#EC4899',
  Shopping: '#F59E0B',
  'Teatro e cinema': '#8B5CF6',
  Spostamenti: '#14B8A6',
  Viaggi: '#F97316',
  Altro: '#64748B',
  Stipendio: '#10B981',
  Contanti: '#06B6D4',
  Rimborsi: '#84CC16',
}

export const CATEGORY_ICONS: Record<string, string> = {
  Cibo: '🍽️',
  Auto: '🚗',
  Salute: '💊',
  Intrattenimento: '🎮',
  Abbonamenti: '📱',
  Shopping: '🛍️',
  'Teatro e cinema': '🎭',
  Spostamenti: '🚇',
  Viaggi: '✈️',
  Altro: '🏷️',
  Stipendio: '💰',
  Contanti: '💵',
  Rimborsi: '📥',
}
