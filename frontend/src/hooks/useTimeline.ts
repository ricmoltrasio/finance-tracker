import { useQuery } from '@tanstack/react-query'
import { transactionsApi } from '../api/transactions'

export function useTimeline(from?: string, to?: string, granularity = 'day') {
  return useQuery({
    queryKey: ['timeline', from, to, granularity],
    queryFn: () => transactionsApi.timeline(from, to, granularity),
  })
}
