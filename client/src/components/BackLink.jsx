import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSwipeBack } from '../hooks/useSwipeBack.js'

// Кнопка «назад» для указательных устройств + свайп от края для сенсорных.
// fallback нужен, когда страницу открыли по прямой ссылке и истории нет.
export default function BackLink({ fallback = '/', label = 'Назад' }) {
  const navigate = useNavigate()

  const goBack = useCallback(() => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(fallback)
  }, [navigate, fallback])

  useSwipeBack(goBack)

  return (
    <button type="button" className="back-link" onClick={goBack}>
      <span aria-hidden="true">←</span> {label}
    </button>
  )
}
