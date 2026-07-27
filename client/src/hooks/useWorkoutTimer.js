import { useEffect, useState } from 'react'

// Таймер переживает перезагрузку страницы: в localStorage лежит только момент
// старта, прошедшее время всегда считается от него, а не накапливается в стейте.
const storageKey = (workoutId) => `askesis:timer:${workoutId}`

export function useWorkoutTimer(workoutId) {
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(workoutId))
    setStartedAt(stored || null)
  }, [workoutId])

  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  function start() {
    const iso = new Date().toISOString()
    localStorage.setItem(storageKey(workoutId), iso)
    setStartedAt(iso)
    setNow(Date.now())
  }

  function reset() {
    localStorage.removeItem(storageKey(workoutId))
    setStartedAt(null)
  }

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0

  return { startedAt, elapsedSeconds, start, reset }
}

export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
