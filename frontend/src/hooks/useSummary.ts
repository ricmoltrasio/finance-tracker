import { useQuery } from '@tanstack/react-query'
import { transactionsApi, type SummaryExtra } from '../api/transactions'

export function useSummary(from?: string, to?: string, extra?: SummaryExtra, enabled = true) {
  return useQuery({
    queryKey: ['summary', from, to, extra ?? null],
    queryFn: () => transactionsApi.summary(from, to, extra),
    enabled,
  })
}
