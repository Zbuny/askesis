import { useEffect } from 'react'

// Пока идёт тренировка, экран не гаснет: между подходами телефон лежит на
// скамье, и каждый раз разблокировать его потными пальцами, чтобы вписать
// вес, — главная мелкая боль в зале. Браузер снимает блокировку при
// сворачивании вкладки, поэтому при возврате берём её заново. Где Wake Lock
// API нет (старый Safari), всё работает как раньше.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return
    let lock = null
    let cancelled = false

    async function acquire() {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) {
          next.release().catch(() => {})
          return
        }
        lock = next
      } catch {
        // Отказ (энергосбережение, вкладка в фоне) — не ошибка для человека.
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [active])
}
