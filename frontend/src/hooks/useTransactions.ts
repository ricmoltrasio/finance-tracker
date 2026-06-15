import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { transactionsApi } from '../api/transactions'
import type { TransactionCreate, TransactionUpdate } from '../types'

/** Ogni modifica ai movimenti rende stantii anche aggregati e timeline. */
function invalidateTransactionData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['summary'] })
  qc.invalidateQueries({ queryKey: ['timeline'] })
}

export function useTransactions(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.list(params),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TransactionCreate) => transactionsApi.create(body),
    onSuccess: () => invalidateTransactionData(qc),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TransactionUpdate }) =>
      transactionsApi.update(id, body),
    onSuccess: () => invalidateTransactionData(qc),
  })
}

export function useSetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, category, onlyThis }: { id: number; category: string; onlyThis?: boolean }) =>
      transactionsApi.setCategory(id, category, onlyThis),
    onSuccess: () => invalidateTransactionData(qc),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: () => invalidateTransactionData(qc),
  })
}
