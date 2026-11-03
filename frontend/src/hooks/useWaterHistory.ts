import { useCallback, useEffect, useState } from 'react'
import { listWaterEntries, WaterApiError } from '../services/water'
import type { WaterEntry } from '../types/water'

type HistoryState =
  | { status: 'loading'; entries: WaterEntry[] | null }
  | { status: 'ready'; entries: WaterEntry[] }
  | { status: 'error'; entries: WaterEntry[] | null; message: string }

export function useWaterHistory(active: boolean, revision: number) {
  const [state, setState] = useState<HistoryState>({
    status: 'loading',
    entries: null,
  })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let obsolete = false
    setState((current) => ({ status: 'loading', entries: current.entries }))
    listWaterEntries(controller.signal)
      .then((entries) => {
        if (!obsolete) setState({ status: 'ready', entries })
      })
      .catch((error: unknown) => {
        if (obsolete) return
        setState((current) => ({
          status: 'error',
          entries: current.entries,
          message:
            error instanceof WaterApiError
              ? error.message
              : 'No se ha podido cargar el historial de agua.',
        }))
      })
    return () => {
      obsolete = true
      controller.abort()
    }
  }, [active, revision, attempt])

  return { ...state, retry }
}
