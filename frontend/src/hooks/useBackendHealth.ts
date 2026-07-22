import { useQuery } from '@tanstack/react-query'
import { healthService } from '@/services/healthService'
import { useAppStore } from '@/store/appStore'

export function useBackendHealth() {
  const setBackendHealth = useAppStore((s) => s.setBackendHealth)

  const query = useQuery({
    queryKey: ['backend-health'],
    queryFn: async () => {
      const status = await healthService.getStatus()
      setBackendHealth(true, status.status, true)
      return status
    },
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 2000,
  })

  if (query.isError) {
    setBackendHealth(false, 'offline', false)
  }

  return {
    isHealthy: !query.isError && !!query.data,
    status: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
