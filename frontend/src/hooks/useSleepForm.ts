import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getMadridToday } from '../lib/sleepCalendar'
import { useSleepToday } from './useSleepToday'
import { toSleepPayload, validateSleep } from '../lib/sleepValidation'
import { SleepApiError, createSleep } from '../services/sleep'
import type { SleepFormValues, SleepRecord } from '../types/sleep'

type FieldName = keyof SleepFormValues
type Feedback = { kind: 'success' | 'error'; message: string } | null
const emptyForm = (): SleepFormValues => ({
  sleepDate: getMadridToday(),
  hoursSlept: '',
  sleepType: '',
})

export function useSleepForm(onSaved?: (record: SleepRecord) => void) {
  const today = useSleepToday()
  const [values, setValues] = useState<SleepFormValues>(emptyForm)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  )
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [validationNotice, setValidationNotice] = useState(false)
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const errors = validateSleep(values, today)

  useEffect(() => () => controller.current?.abort(), [])

  function update(field: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    if (feedback?.kind === 'success') setFeedback(null)
    setValidationNotice(false)
  }

  function blur(field: FieldName) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The synchronous lock also prevents a second submit before React re-renders.
    if (inFlight.current) return
    setFeedback(null)
    setTouched({ sleepDate: true, hoursSlept: true, sleepType: true })
    const firstInvalid = (Object.keys(errors) as FieldName[])[0]
    if (firstInvalid) {
      setValidationNotice(true)
      const field = form.current?.elements.namedItem(firstInvalid)
      if (field instanceof HTMLElement) field.focus()
      return
    }

    setValidationNotice(false)
    inFlight.current = true
    setSubmitting(true)
    const requestController = new AbortController()
    controller.current = requestController
    let savedRecord: SleepRecord | undefined
    try {
      const record = await createSleep(toSleepPayload(values), {
        signal: requestController.signal,
      })
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'success',
        message: 'Horas de sueño registradas correctamente.',
      })
      setValues(emptyForm())
      setTouched({})
      savedRecord = record
    } catch (error) {
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'error',
        message:
          error instanceof SleepApiError
            ? error.message
            : 'No se ha podido confirmar el registro. Tus datos siguen en el formulario.',
      })
    } finally {
      inFlight.current = false
      if (!requestController.signal.aborted) setSubmitting(false)
    }
    // La actualización del panel es independiente del resultado del POST.
    if (savedRecord && !requestController.signal.aborted) onSaved?.(savedRecord)
  }

  const visibleError = (field: FieldName) =>
    touched[field] ? errors[field] : undefined

  return {
    today,
    values,
    submitting,
    feedback,
    validationNotice,
    form,
    update,
    blur,
    submit,
    visibleError,
  }
}
