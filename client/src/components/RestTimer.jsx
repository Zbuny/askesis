import { useEffect } from 'react'
import { REST_STEP, formatRest } from '../utils/restTimer.js'

// Панель отдыха прибита к низу экрана, над навигацией: телефон лежит на
// скамье, и смотреть на него приходится издалека. Поэтому цифры крупные,
// а кнопки — в зоне большого пальца.
export default function RestTimer({ rest, left, finished, onAdjust, onStop }) {
  // Отсчёт в заголовке вкладки виден, даже когда человек ушёл на другой
  // экран или в другое приложение и вернулся к списку вкладок.
  useEffect(() => {
    if (!rest) return
    const original = document.title
    document.title = finished ? 'Отдых окончен — Askesis' : `${formatRest(left)} · отдых — Askesis`
    return () => {
      document.title = original
    }
  }, [rest, left, finished])

  if (!rest) return null

  const progress = rest.duration ? Math.min(1, Math.max(0, 1 - left / rest.duration)) : 0

  return (
    <div className={`rest-timer${finished ? ' is-finished' : ''}`} role="region" aria-label="Отдых между подходами">
      <span className="rest-timer__bar" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <div className="rest-timer__info">
        <span className="rest-timer__label">{finished ? 'Пора' : 'Отдых'}{rest.label ? ` · ${rest.label}` : ''}</span>
        {/* Скринридеру — только смена состояния, а не каждая секунда. */}
        <strong className="rest-timer__value" aria-hidden={!finished}>
          {finished ? 'Следующий подход' : formatRest(left)}
        </strong>
        <span className="visually-hidden" role="status">
          {finished ? 'Отдых окончен, следующий подход' : ''}
        </span>
      </div>
      {!finished && (
        <div className="rest-timer__controls">
          <button type="button" onClick={() => onAdjust(-REST_STEP)} aria-label={`Убавить отдых на ${REST_STEP} секунд`}>
            −{REST_STEP}
          </button>
          <button type="button" onClick={() => onAdjust(REST_STEP)} aria-label={`Добавить ${REST_STEP} секунд отдыха`}>
            +{REST_STEP}
          </button>
        </div>
      )}
      <button type="button" className="rest-timer__skip" onClick={onStop}>
        {finished ? 'Ок' : 'Хватит'}
      </button>
    </div>
  )
}
