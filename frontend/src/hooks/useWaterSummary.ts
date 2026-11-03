import { useCallback, useEffect, useState } from 'react'
import { getWaterToday, WaterApiError } from '../services/water'
import type { WaterDailyTotal } from '../types/water'
import { useSleepToday } from './useSleepToday'

type SummaryState =
  | { status: 'loading'; value?: WaterDailyTotal }
  | { status: 'ready'; value: WaterDailyTotal }
  | { status: 'error'; value?: WaterDailyTotal; message: string }

export function useWaterSummary(active: boolean) {
  const today = useSleepToday(active)
  const [state, setState] = useState<SummaryState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setState((current) => ({ status: 'loading', value: current.value }))
    getWaterToday(controller.signal)
      .then((value) => setState({ status: 'ready', value }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState((current) => ({
          status: 'error',
          value: current.value,
          message:
            error instanceof WaterApiError
              ? error.message
              : 'No se ha podido cargar el consumo diario de agua.',
        }))
      })
    return () => controller.abort()
  }, [active, revision, today])

  return { state, refresh }
}
