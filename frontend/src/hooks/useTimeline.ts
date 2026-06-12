import { useQuery } from '@tanstack/react-query'
import { transactionsApi } from '../api/transactions'

export function useTimeline(from?: string, to?: string, granularity = 'day', category?: string) {
  return useQuery({
    queryKey: ['timeline', from, to, granularity, category],
    queryFn: () => transactionsApi.timeline(from, to, granularity, category),
  })
}
