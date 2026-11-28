import { Link } from 'react-router-dom'
import BrandMark from './BrandMark.jsx'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <span className="footer__wordmark">
            <BrandMark variant="full" />
            <span className="brand-word">Askesis</span>
          </span>
          <p>Система дисциплины и прогресса для тех, кто выбирает контроль над собой.</p>
        </div>
        <nav className="footer__links">
          <Link to="/dashboard">Обзор</Link>
          <Link to="/programs">Программы</Link>
          <Link to="/exercises">Упражнения</Link>
          <Link to="/workouts">Тренировки</Link>
          <Link to="/statistics">Статистика</Link>
          <Link to="/nutrition">Питание</Link>
          <Link to="/profile">Профиль</Link>
        </nav>
      </div>
      <p className="footer__bottom">&copy; {new Date().getFullYear()} Askesis — Личный проект, не публичный продукт</p>
    </footer>
  )
}
