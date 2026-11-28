import { useCallback, useState } from 'react'
import { friendlyErrorMessage } from '../utils/errors.js'

// Общий паттерн для кнопок-действий (сохранить/удалить/сгенерировать):
// сбросить ошибку, выставить busy, выполнить запрос, показать ошибку текстом
// при неудаче. run() пробрасывает исключение дальше — вызывающий код может
// сам решить, что делать при неудаче (например, не закрывать форму).
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (fn) => {
    setError(null)
    setBusy(true)
    try {
      return await fn()
    } catch (err) {
      setError(friendlyErrorMessage(err))
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, setError, run }
}
