import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="not-found">
      <span className="eyebrow">Ошибка 404</span>
      <h1>Страница не найдена</h1>
      <p>Такого раздела нет — возможно, ссылка устарела или в адресе опечатка.</p>
      <div className="hero__actions">
        <Link to="/" className="button">На главную</Link>
        <Link to="/exercises" className="button--ghost">К библиотеке упражнений</Link>
      </div>
    </section>
  )
}
