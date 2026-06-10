import { useQuery } from '@tanstack/react-query'
import { transactionsApi } from '../api/transactions'

export function useSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: ['summary', from, to],
    queryFn: () => transactionsApi.summary(from, to),
    enabled: true,
  })
}
