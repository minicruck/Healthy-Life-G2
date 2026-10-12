import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toSleepPayload, validateSleep } from '../lib/sleepValidation'
import { SleepApiError, updateSleep } from '../services/sleep'
import type { SleepFormValues, SleepRecord } from '../types/sleep'
import { useSleepToday } from './useSleepToday'

type FieldName = keyof SleepFormValues

export function useSleepEdit(
  record: SleepRecord,
  onSaved: (record: SleepRecord) => void,
) {
  const today = useSleepToday()
  const [values, setValues] = useState<SleepFormValues>(() => ({
    sleepDate: record.sleepDate,
    hoursSlept: String(record.hoursSlept),
    sleepType: record.sleepType ?? '',
  }))
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationNotice, setValidationNotice] = useState(false)
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const errors = validateSleep(values, today)

  useEffect(() => () => controller.current?.abort(), [])

  function update(field: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setValidationNotice(false)
  }

  function blur(field: FieldName) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setError(null)
    setTouched({ sleepDate: true, hoursSlept: true, sleepType: true })
    const firstInvalid = (Object.keys(errors) as FieldName[])[0]
    if (firstInvalid) {
      setValidationNotice(true)
      const field = form.current?.elements.namedItem(firstInvalid)
      if (field instanceof HTMLElement) field.focus()
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setValidationNotice(false)
    const requestController = new AbortController()
    controller.current = requestController
    let saved: SleepRecord | undefined
    try {
      saved = await updateSleep(record, toSleepPayload(values), {
        signal: requestController.signal,
      })
    } catch (failure) {
      if (requestController.signal.aborted) return
      setError(
        failure instanceof SleepApiError
          ? failure.message
          : 'No se ha podido confirmar la actualización. Los cambios siguen en el formulario.',
      )
    } finally {
      inFlight.current = false
      if (!requestController.signal.aborted) setSubmitting(false)
    }
    // Refreshing the dashboard must not change the confirmed result of this PATCH.
    if (saved && !requestController.signal.aborted) onSaved(saved)
  }

  return {
    today,
    values,
    submitting,
    error,
    validationNotice,
    form,
    update,
    blur,
    submit,
    visibleError: (field: FieldName) =>
      touched[field] ? errors[field] : undefined,
  }
}
