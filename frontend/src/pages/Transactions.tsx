import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTransactions } from '../hooks/useTransactions'
import { TransactionList } from '../components/transactions/TransactionList'
import { EditDrawer, CreateDrawer } from '../components/transactions/TransactionDrawer'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input, Select } from '../components/common/Input'
import type { Transaction } from '../types'
import { CATEGORIES } from '../types'
import { startOfMonth, today } from '../utils/format'

const PAGE_SIZE = 50

export default function Transactions() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(today())
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const params = {
    search: search || undefined,
    category: category || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset,
  }

  const { data, isLoading } = useTransactions(params)
  const total = data?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)
  const page = Math.floor(offset / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Transazioni"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Aggiungi
          </Button>
        }
      />

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <Select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setOffset(0) }}
            className="w-40"
          >
            <option value="">Tutte le cat.</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setOffset(0) }}
            className="flex-1"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setOffset(0) }}
            className="flex-1"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto bg-white">
        <TransactionList
          transactions={data?.data ?? []}
          loading={isLoading}
          onSelect={(t) => setSelected(t)}
        />
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-3 text-sm text-gray-500">
          <span>{total} transazioni</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              ← Prec
            </button>
            <span>{page + 1} / {pages}</span>
            <button
              disabled={page >= pages - 1}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Succ →
            </button>
          </div>
        </div>
      )}

      {selected && <EditDrawer transaction={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} />}
    </div>
  )
}
