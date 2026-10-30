import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  localToday,
  toActivityPayload,
  validateActivity,
} from '../lib/activityValidation'
import { ApiError, createActivity } from '../services/activities'
import type { ActivityFormValues } from '../types/activity'

type FieldName = keyof ActivityFormValues
type Feedback = { kind: 'success' | 'error'; message: string } | null
const emptyForm = (): ActivityFormValues => ({
  activityType: '',
  activityDate: localToday(),
  notes: '',
})

export function useActivityForm(options: { onSaved?: () => void } = {}) {
  const [values, setValues] = useState<ActivityFormValues>(emptyForm)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  )
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [validationNotice, setValidationNotice] = useState(false)
  // A ref closes the gap before React renders the disabled button.
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const errors = validateActivity(values)

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
    if (inFlight.current) return
    setFeedback(null)
    setTouched({ activityType: true, activityDate: true, notes: true })
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
    try {
      await createActivity(toActivityPayload(values), {
        signal: requestController.signal,
      })
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'success',
        message: 'Actividad registrada correctamente.',
      })
      options.onSaved?.()
      setValues(emptyForm())
      setTouched({})
    } catch (error) {
      if (requestController.signal.aborted) return
      setFeedback({
        kind: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'No se ha podido confirmar el registro. Tus datos siguen en el formulario.',
      })
    } finally {
      inFlight.current = false
      if (!requestController.signal.aborted) setSubmitting(false)
    }
  }

  const visibleError = (field: FieldName) =>
    touched[field] ? errors[field] : undefined

  return {
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
