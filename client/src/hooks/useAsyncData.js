import { useCallback, useEffect, useState } from 'react'
import { friendlyErrorMessage } from '../utils/errors.js'

// Общий паттерн для страниц-списков: загрузить данные один раз, показать
// "Загрузка...", а при ошибке — текст вместо содержимого. reload() отдаём
// наружу, чтобы можно было перезапросить данные после изменения (например,
// после удаления записи), не размонтируя компонент.
export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetcher()
      .then((result) => {
        setData(result)
        return result
      })
      .catch((err) => {
        setError(friendlyErrorMessage(err))
        throw err
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, setData, loading, error, setError, reload }
}
