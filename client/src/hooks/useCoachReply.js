import { useState } from 'react'
import { askCoach } from '../api/ai.js'
import { friendlyErrorMessage } from '../utils/errors.js'

// Комментарий тренера к уже посчитанным наблюдениям. Хук общий, потому что
// просят его два экрана — дашборд и разбор после тренировки, — и оба обязаны
// одинаково пережить неразвёрнутый воркер или упавший Groq: наблюдения на
// экране остаются, пропадает только пересказ. Поэтому ошибка здесь не
// пробрасывается наружу, в отличие от useAsyncAction.
export function useCoachReply(kind) {
  const [reply, setReply] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function explain(facts) {
    setError(null)
    setBusy(true)
    try {
      setReply(await askCoach({ kind, facts }))
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return { reply, busy, error, explain }
}
