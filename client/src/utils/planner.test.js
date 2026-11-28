import { describe, it, expect } from 'vitest'
import { estimateMinutes, lastPerformed, nextAfter, suggestTodayWorkout, workoutMuscles } from './planner.js'

const workout = (id, title, items = []) => ({ id, title, items })
const log = (workoutId, date) => ({ workoutId, date: `${date}T12:00:00` })

describe('lastPerformed', () => {
  it('берёт самую свежую дату по каждой тренировке', () => {
    const history = [log('w1', '2026-08-11'), log('w1', '2026-08-01'), log('w2', '2026-08-05')]
    const map = lastPerformed(history)
    expect(map.get('w1')).toBe('2026-08-11T12:00:00')
    expect(map.get('w2')).toBe('2026-08-05T12:00:00')
  })

  it('записи без тренировки игнорируются', () => {
    expect(lastPerformed([{ date: '2026-08-11T12:00:00' }]).size).toBe(0)
  })
})

describe('suggestTodayWorkout', () => {
  it('без тренировок предлагать нечего', () => {
    expect(suggestTodayWorkout([], [])).toBeNull()
  })

  it('предлагает ту, до которой дольше всего не доходили', () => {
    const workouts = [workout('w1', 'Грудь'), workout('w2', 'Спина')]
    const history = [log('w1', '2026-08-11'), log('w2', '2026-08-01')]
    expect(suggestTodayWorkout(workouts, history).workout.id).toBe('w2')
  })

  it('ни разу не выполненная тренировка идёт впереди давних', () => {
    const workouts = [workout('w1', 'Грудь'), workout('w2', 'Ноги')]
    const history = [log('w1', '2020-01-01')]
    expect(suggestTodayWorkout(workouts, history).workout.id).toBe('w2')
  })

  it('при равных условиях выбор не прыгает между вызовами', () => {
    const workouts = [workout('w2', 'Спина'), workout('w1', 'Грудь')]
    const first = suggestTodayWorkout(workouts, [])
    const second = suggestTodayWorkout(workouts, [])
    expect(first.workout.id).toBe(second.workout.id)
    // Из двух невыполненных берётся первая по алфавиту.
    expect(first.workout.title).toBe('Грудь')
  })

  it('видит, что тренировку уже сделали сегодня', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = suggestTodayWorkout([workout('w1', 'Грудь')], [log('w1', today)])
    expect(result.doneToday).toBe(true)
  })

  it('вчерашняя тренировка сегодняшней не считается', () => {
    const result = suggestTodayWorkout([workout('w1', 'Грудь')], [log('w1', '2020-01-01')])
    expect(result.doneToday).toBe(false)
  })
})

describe('nextAfter', () => {
  it('показывает следующую в очереди, исключая текущую', () => {
    const workouts = [workout('w1', 'Грудь'), workout('w2', 'Спина'), workout('w3', 'Ноги')]
    const history = [log('w1', '2026-08-01'), log('w2', '2026-08-05'), log('w3', '2026-08-11')]
    expect(nextAfter(workouts, history, 'w1').id).toBe('w2')
  })

  it('когда других тренировок нет, возвращает пусто', () => {
    expect(nextAfter([workout('w1', 'Грудь')], [], 'w1')).toBeNull()
  })
})

describe('estimateMinutes', () => {
  it('считает время по числу подходов', () => {
    expect(estimateMinutes(workout('w1', 'Грудь', [{ targetSets: 4 }, { targetSets: 3 }]))).toBe(21)
  })

  it('без подходов времени не показываем', () => {
    expect(estimateMinutes(workout('w1', 'Пусто', []))).toBe(0)
  })
})

describe('workoutMuscles', () => {
  const exerciseById = new Map([
    ['ex1', { muscleGroup: 'chest' }],
    ['ex2', { muscleGroup: 'chest' }],
    ['ex3', { muscleGroup: 'triceps' }],
  ])

  it('собирает группы мышц без повторов', () => {
    const w = workout('w1', 'Грудь', [{ exerciseId: 'ex1' }, { exerciseId: 'ex2' }, { exerciseId: 'ex3' }])
    expect(workoutMuscles(w, exerciseById)).toEqual(['chest', 'triceps'])
  })

  it('применяет перевод, если он передан', () => {
    const w = workout('w1', 'Грудь', [{ exerciseId: 'ex1' }])
    expect(workoutMuscles(w, exerciseById, () => 'Грудь')).toEqual(['Грудь'])
  })

  it('неизвестные упражнения пропускаются', () => {
    const w = workout('w1', 'Грудь', [{ exerciseId: 'nope' }])
    expect(workoutMuscles(w, exerciseById)).toEqual([])
  })
})
