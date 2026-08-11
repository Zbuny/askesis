import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
    </svg>
  )
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  function closeMenu() {
    setOpen(false)
  }

  return (
    <header className="navbar">
      <div className="navbar__bar">
        <Link to="/" className="navbar__logo" onClick={closeMenu}>
          <img src="/logo.png" alt="" className="navbar__logo-img" />
          Askesis
        </Link>
        <div className="navbar__bar-actions">
          <button
            type="button"
            className="navbar__theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className="navbar__toggle"
            aria-label="Меню"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      <nav className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
        <NavLink to="/" onClick={closeMenu}>Главная</NavLink>
        <NavLink to="/programs" onClick={closeMenu}>Программы</NavLink>
        <NavLink to="/exercises" onClick={closeMenu}>Упражнения</NavLink>
        {user ? (
          <>
            <NavLink to="/dashboard" onClick={closeMenu}>Обзор</NavLink>
            <NavLink to="/workouts" onClick={closeMenu}>Мои тренировки</NavLink>
            <NavLink to="/statistics" onClick={closeMenu}>Статистика</NavLink>
            <NavLink to="/nutrition" onClick={closeMenu}>Питание</NavLink>
            <NavLink to="/profile" onClick={closeMenu}>Профиль</NavLink>
            {isAdmin && <NavLink to="/admin" onClick={closeMenu}>Админка</NavLink>}
            <button onClick={() => { logout(); closeMenu() }}>Выйти</button>
          </>
        ) : (
          <Link to="/login" className="button button--nav" onClick={closeMenu}>
            Войти
          </Link>
        )}
      </nav>
    </header>
  )
}
