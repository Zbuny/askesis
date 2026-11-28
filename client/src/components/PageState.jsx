import { Link } from 'react-router-dom'

// Три состояния, которые есть у каждой страницы-списка: грузится, сломалось,
// пусто. Раньше это были голые «Загрузка...» и «Ошибка: …» — экран дёргался,
// когда текст сменялся контентом, а после ошибки оставалось только
// перезагружать вкладку целиком.

export function PageLoading({ cards = 3, label = 'Загружаем' }) {
  return (
    <section className="page-loading" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label}…</span>
      <div className="skeleton skeleton--title" />
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="skeleton skeleton--card" />
      ))}
    </section>
  )
}

// onRetry — обычно reload() из useAsyncData. Без него показываем только путь
// назад: тупик без выхода хуже любой ошибки.
export function PageError({ title = 'Не получилось загрузить', message, onRetry, backTo, backLabel = 'На обзор' }) {
  return (
    <section className="empty-state empty-state--error" role="alert">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      <div className="empty-state__actions">
        {onRetry && (
          <button type="button" className="button" onClick={() => onRetry()?.catch?.(() => {})}>
            Повторить
          </button>
        )}
        {backTo && (
          <Link to={backTo} className="button--ghost">
            {backLabel}
          </Link>
        )}
      </div>
    </section>
  )
}

// Пустой список — не ошибка, а приглашение: всегда со следующим шагом.
export function EmptyState({ title, text, children }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  )
}
