import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toWaterPayload, validateWater } from '../lib/waterValidation'
import { createWaterEntry, WaterApiError } from '../services/water'
import type { WaterFormValues } from '../types/water'

type Feedback = { kind: 'success' | 'error'; message: string } | null

export function useWaterForm(onSaved?: () => void) {
  const [values, setValues] = useState<WaterFormValues>({ amountMl: '' })
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [validationNotice, setValidationNotice] = useState(false)
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const errors = validateWater(values)

  useEffect(() => () => controller.current?.abort(), [])

  function update(value: string) {
    setValues({ amountMl: value })
    if (feedback?.kind === 'success') setFeedback(null)
    setValidationNotice(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setFeedback(null)
    setTouched(true)
    if (errors.amountMl) {
      setValidationNotice(true)
      const field = form.current?.elements.namedItem('amountMl')
      if (field instanceof HTMLElement) field.focus()
      return
    }

    setValidationNotice(false)
    inFlight.current = true
    setSubmitting(true)
    const requestController = new AbortController()
    controller.current = requestController
    try {
      await createWaterEntry(toWaterPayload(values), {
        signal: requestController.signal,
      })
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'success',
        message: 'Consumo de agua registrado correctamente.',
      })
      setValues({ amountMl: '' })
      setTouched(false)
      onSaved?.()
    } catch (error) {
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'error',
        message:
          error instanceof WaterApiError
            ? error.message
            : 'No se ha podido confirmar el registro. La cantidad sigue en el formulario.',
      })
    } finally {
      inFlight.current = false
      if (!requestController.signal.aborted) setSubmitting(false)
    }
  }

  return {
    values,
    submitting,
    feedback,
    validationNotice,
    form,
    update,
    blur: () => setTouched(true),
    submit,
    visibleError: touched ? errors.amountMl : undefined,
  }
}
