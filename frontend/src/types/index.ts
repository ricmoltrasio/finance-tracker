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
  deleted_at: string | null
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
  amount?: number
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

/** colore + icona stroke (nome icona del componente Icon) per ogni categoria */
export const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  Cibo: { color: '#5FD0A0', icon: 'cart' },
  Auto: { color: '#6AA6FF', icon: 'car' },
  Salute: { color: '#5BD1D7', icon: 'heart' },
  Intrattenimento: { color: '#EF7B7B', icon: 'play' },
  Abbonamenti: { color: '#B388FF', icon: 'repeat' },
  Shopping: { color: '#F2A65A', icon: 'bag' },
  'Teatro e cinema': { color: '#C792EA', icon: 'ticket' },
  Spostamenti: { color: '#7EE081', icon: 'train' },
  Viaggi: { color: '#F2C14E', icon: 'plane' },
  Altro: { color: '#8A93A0', icon: 'dots' },
  Stipendio: { color: '#4ECB71', icon: 'wallet' },
  Contanti: { color: '#46C8B0', icon: 'coins' },
  Rimborsi: { color: '#84CC16', icon: 'refund' },
}

export function catMeta(category: string) {
  return CATEGORY_META[category] ?? { color: '#8A93A0', icon: 'dots' }
}

/** retro-compat: alcune viste leggono ancora questi due record */
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color])
)

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
