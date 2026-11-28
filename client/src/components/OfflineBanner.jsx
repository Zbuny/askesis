import { useEffect, useState } from 'react'

// В подвальных залах связь пропадает посреди тренировки, и без подсказки
// ошибка сохранения выглядит как поломка приложения. Подходы при этом уже
// лежат в черновике на телефоне (см. utils/workoutDraft.js) — говорим об этом
// прямо, чтобы человек не перепечатывал их и не закрывал вкладку в панике.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null

  return (
    <div className="offline-banner" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18" />
      </svg>
      Нет сети. Введённые подходы сохранены на телефоне — запишите тренировку, когда связь вернётся.
    </div>
  )
}
