import { useCallback, useEffect, useRef, useState } from 'react'
import { clampRest, remainingSeconds } from '../utils/restTimer.js'

// Отдых живёт в localStorage так же, как таймер тренировки: экран гаснет,
// человек уходит посмотреть «как выполнять» — и возвращается к тому же
// обратному отсчёту, а не к нулю.
const storageKey = (workoutId) => `askesis:rest:${workoutId}`
const PREFS_KEY = 'askesis:rest-prefs'
// Сколько держать на экране «отдых окончен», если человек его не закрыл.
const FINISHED_VISIBLE_MS = 10_000

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Приватный режим или переполнение — таймер просто не переживёт перезагрузку.
  }
}

export function loadRestPreferences() {
  const prefs = readJson(PREFS_KEY)
  return prefs && typeof prefs === 'object' ? prefs : {}
}

function saveRestPreference(exerciseId, seconds) {
  if (!exerciseId) return
  writeJson(PREFS_KEY, { ...loadRestPreferences(), [exerciseId]: clampRest(seconds) })
}

// Короткий двойной сигнал. Звук создаётся на лету: аудиофайл ради двух
// писков — лишний запрос, а WebAudio есть во всех нужных браузерах.
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.2)
    })
    setTimeout(() => ctx.close().catch(() => {}), 800)
  } catch {
    // Без звука — останется вибрация и надпись на экране.
  }
}

function signalFinished() {
  try {
    navigator.vibrate?.([180, 90, 180])
  } catch {
    // vibrate недоступен (iOS) — хватит звука и надписи.
  }
  beep()
}

export function useRestTimer(workoutId) {
  const [rest, setRest] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const signalled = useRef(false)

  useEffect(() => {
    const stored = readJson(storageKey(workoutId))
    // Отдых, закончившийся давно (вкладку закрыли посреди паузы), не
    // воскрешаем: «отдых окончен» спустя час только сбивает.
    if (stored?.endsAt && Date.now() - stored.endsAt < FINISHED_VISIBLE_MS) {
      signalled.current = Date.now() >= stored.endsAt
      setRest(stored)
    } else {
      writeJson(storageKey(workoutId), null)
      setRest(null)
    }
  }, [workoutId])

  useEffect(() => {
    if (!rest) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [rest])

  const left = rest ? remainingSeconds(rest.endsAt, now) : 0
  const finished = Boolean(rest) && left === 0

  useEffect(() => {
    if (!finished || signalled.current) return
    signalled.current = true
    signalFinished()
  }, [finished])

  // Закончившийся отдых сам убирается через несколько секунд.
  useEffect(() => {
    if (!finished) return
    const timeout = setTimeout(() => {
      setRest(null)
      writeJson(storageKey(workoutId), null)
    }, Math.max(0, rest.endsAt + FINISHED_VISIBLE_MS - Date.now()))
    return () => clearTimeout(timeout)
  }, [finished, rest, workoutId])

  const persist = useCallback(
    (next) => {
      setRest(next)
      writeJson(storageKey(workoutId), next)
    },
    [workoutId],
  )

  const start = useCallback(
    ({ seconds, exerciseId, label }) => {
      const duration = clampRest(seconds)
      signalled.current = false
      setNow(Date.now())
      persist({ endsAt: Date.now() + duration * 1000, duration, exerciseId, label })
    },
    [persist],
  )

  // ±15 секунд к текущему отдыху. Итоговая длительность запоминается для
  // упражнения: если человеку на приседе нужно три минуты, а не две, он
  // скажет об этом один раз, а не на каждом подходе.
  const adjust = useCallback(
    (delta) => {
      if (!rest) return
      const current = Date.now()
      const leftNow = remainingSeconds(rest.endsAt, current)
      const nextLeft = Math.max(0, leftNow + delta)
      const duration = clampRest(rest.duration + delta)
      saveRestPreference(rest.exerciseId, duration)
      if (nextLeft === 0) {
        signalled.current = true
        persist(null)
        return
      }
      signalled.current = false
      setNow(current)
      persist({ ...rest, endsAt: current + nextLeft * 1000, duration: Math.max(duration, nextLeft) })
    },
    [rest, persist],
  )

  const stop = useCallback(() => {
    signalled.current = true
    persist(null)
  }, [persist])

  return { rest, left, finished, start, adjust, stop }
}
