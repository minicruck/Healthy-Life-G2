import { describe, expect, it, vi } from 'vitest'
import type { ActivityFormValues } from '../types/activity'
import {
  isRealCalendarDate,
  localToday,
  toActivityPayload,
  validateActivity,
} from './activityValidation'

const validValues: ActivityFormValues = {
  activityType: 'walking',
  activityDate: '2026-10-09',
  intensity: 'moderate',
  notes: '',
}

describe('calendar dates', () => {
  it.each([
    '2026-10-09',
    '2024-02-29',
    '2000-02-29',
    '0001-01-01',
    '9999-12-31',
  ])('accepts the real Gregorian date %s', (value) =>
    expect(isRealCalendarDate(value)).toBe(true),
  )

  it.each([
    '2026-02-30',
    '2026-02-29',
    '1900-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '0000-01-01',
    '2026-1-09',
    '09/10/2026',
    '2026-10-09T00:00:00.000Z',
    ' 2026-10-09',
    '2026-10-09\n',
    '',
  ])('rejects the nonexistent or malformed date %s', (value) => {
    expect(isRealCalendarDate(value)).toBe(false)
  })

  it('uses local calendar components near midnight without an ISO/UTC conversion', () => {
    const date = new Date(2026, 9, 9, 23, 59, 59)
    const isoConversion = vi.spyOn(date, 'toISOString')
    expect(localToday(date)).toBe('2026-10-09')
    expect(localToday(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02')
    expect(isoConversion).not.toHaveBeenCalled()
    isoConversion.mockRestore()
  })

  it('defaults to the current local date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 9, 23, 59))
    expect(localToday()).toBe('2026-10-09')
    vi.useRealTimers()
  })
})

describe('activity validation and payload', () => {
  it('accepts every agreed activity type', () => {
    for (const activityType of [
      'walking',
      'running',
      'cycling',
      'gym',
      'other',
    ] as const) {
      expect(validateActivity({ ...validValues, activityType })).toEqual({})
    }
  })

  it('requires both activity type and date', () => {
    expect(
      validateActivity({
        activityType: '',
        activityDate: '',
        intensity: '',
        notes: '',
      }),
    ).toEqual({
      activityType: expect.any(String),
      activityDate: expect.any(String),
      intensity: expect.any(String),
    })
  })

  it('rejects unsupported runtime activity types and nonexistent dates', () => {
    expect(
      validateActivity({
        ...validValues,
        activityType: 'swimming' as ActivityFormValues['activityType'],
        activityDate: '2026-02-30',
      }),
    ).toEqual({
      activityType: expect.any(String),
      activityDate: expect.any(String),
    })
  })

  it('does not invent a future-date restriction', () => {
    expect(
      validateActivity({ ...validValues, activityDate: '2099-12-31' }),
    ).toEqual({})
  })

  it('accepts 500 characters and rejects 501, including whitespace', () => {
    expect(
      validateActivity({ ...validValues, notes: 'a'.repeat(500) }),
    ).toEqual({})
    expect(
      validateActivity({ ...validValues, notes: 'a'.repeat(501) }),
    ).toHaveProperty('notes')
    expect(
      validateActivity({ ...validValues, notes: ' '.repeat(501) }),
    ).toHaveProperty('notes')
  })

  it.each(['', '   ', '\n\t ', '\u00a0 \t\n'])(
    'omits optional notes containing only whitespace (%j)',
    (notes) => {
      expect(toActivityPayload({ ...validValues, notes })).toEqual({
        activityType: 'walking',
        activityDate: '2026-10-09',
        intensity: 'moderate',
      })
    },
  )

  it.each([
    ['  Paseo por el parque.', 'Paseo por el parque.'],
    ['Paseo por el parque.  ', 'Paseo por el parque.'],
    ['  Paseo por el parque.  ', 'Paseo por el parque.'],
    [
      '\u00a0\t Paseo  por el parque.\nSegunda vuelta.\n ',
      'Paseo  por el parque.\nSegunda vuelta.',
    ],
  ])(
    'normalizes note edges (%j) without changing inner whitespace or the form',
    (notes, expected) => {
      const values = { ...validValues, notes }
      expect(toActivityPayload(values)).toEqual({
        activityType: 'walking',
        activityDate: '2026-10-09',
        intensity: 'moderate',
        notes: expected,
      })
      expect(values.notes).toBe(notes)
    },
  )

  it('never constructs a payload with invalid fields', () => {
    expect(() =>
      toActivityPayload({ ...validValues, activityType: '' }),
    ).toThrow()
    expect(() =>
      toActivityPayload({ ...validValues, activityDate: '2026-02-30' }),
    ).toThrow()
    expect(() =>
      toActivityPayload({ ...validValues, notes: 'x'.repeat(501) }),
    ).toThrow()
    expect(() =>
      toActivityPayload({ ...validValues, intensity: '' }),
    ).toThrow()
  })

  // HU4 — Intensidad del entrenamiento
  it.each(['low', 'moderate', 'high'] as const)(
    'HU4 CA1: acepta la intensidad %s y la incluye en el JSON',
    (intensity) => {
      expect(validateActivity({ ...validValues, intensity })).toEqual({})
      expect(toActivityPayload({ ...validValues, intensity })).toMatchObject({
        intensity,
      })
    },
  )

  it.each(['', 'extreme', 'HIGH'])(
    'HU4 CA3: exige una intensidad válida (%j)',
    (intensity) => {
      expect(
        validateActivity({
          ...validValues,
          intensity: intensity as ActivityFormValues['intensity'],
        }),
      ).toEqual({ intensity: 'Selecciona la intensidad del entrenamiento.' })
    },
  )
})
