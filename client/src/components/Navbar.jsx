import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
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
      <nav className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
        <NavLink to="/" onClick={closeMenu}>Главная</NavLink>
        <NavLink to="/programs" onClick={closeMenu}>Программы</NavLink>
        <NavLink to="/exercises" onClick={closeMenu}>Упражнения</NavLink>
        {user ? (
          <>
            <NavLink to="/workouts" onClick={closeMenu}>Мои тренировки</NavLink>
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
