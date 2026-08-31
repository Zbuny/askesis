import { afterEach, describe, expect, it } from 'vitest'
import {
  builderDraftKey,
  clearBuilderDraft,
  clearSessionDraft,
  loadBuilderDraft,
  loadSessionDraft,
  saveBuilderDraft,
  saveSessionDraft,
  sessionDraftKey,
} from './workoutDraft.js'

afterEach(() => {
  localStorage.clear()
})

describe('builder draft', () => {
  it('сохраняет и восстанавливает название с упражнениями', () => {
    const items = [{ exerciseId: 'Push_Up', exerciseName: 'Отжимания', targetSets: 3, targetReps: 10 }]
    saveBuilderDraft(null, { title: 'День A', items })
    expect(loadBuilderDraft(null)).toEqual(expect.objectContaining({ title: 'День A', items }))
  })

  it('разводит черновики новой и редактируемой тренировки', () => {
    saveBuilderDraft(null, { title: 'Новая', items: [] })
    saveBuilderDraft('w1', { title: 'Старая', items: [{ exerciseId: 'a' }] })
    expect(loadBuilderDraft(null)?.title).toBe('Новая')
    expect(loadBuilderDraft('w1')?.title).toBe('Старая')
  })

  it('очищает черновик после сохранения', () => {
    saveBuilderDraft('w1', { title: 'X', items: [] })
    clearBuilderDraft('w1')
    expect(loadBuilderDraft('w1')).toBeNull()
  })
})

describe('session draft', () => {
  it('восстанавливает введённые подходы за сегодня', () => {
    saveSessionDraft('w1', {
      results: { Push_Up: [{ weight: '20', reps: '12' }] },
      rir: { Push_Up: 2 },
      followed: ['Push_Up'],
    })
    const draft = loadSessionDraft('w1')
    expect(draft.results.Push_Up[0]).toEqual({ weight: '20', reps: '12' })
    expect(draft.rir.Push_Up).toBe(2)
    expect(draft.followed).toEqual(['Push_Up'])
  })

  it('не поднимает вчерашний черновик', () => {
    const key = sessionDraftKey('w1')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    localStorage.setItem(
      key,
      JSON.stringify({
        date: yesterday.toISOString().slice(0, 10),
        results: { Push_Up: [{ weight: '99', reps: '1' }] },
        rir: {},
        followed: [],
      }),
    )
    expect(loadSessionDraft('w1')).toBeNull()
  })
})

describe('keys', () => {
  it('строит предсказуемые ключи', () => {
    expect(builderDraftKey(null)).toBe('askesis:draft:builder:new')
    expect(builderDraftKey('abc')).toBe('askesis:draft:builder:abc')
    expect(sessionDraftKey('abc')).toBe('askesis:draft:session:abc')
  })
})
