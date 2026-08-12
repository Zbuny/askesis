import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Нижняя навигация для телефона. Основная сессия проходит в зале, одной
// рукой и часто на весу — гамбургер в шапке для этого неудобен: до него
// надо тянуться большим пальцем через весь экран. Пять целей внизу
// покрывают весь цикл, а центральная кнопка собирает действия, ради
// которых приложение и открывают.
//
// Панель показывается только вошедшим: гостю переходить некуда.

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

const ACTIONS = [
  { to: '/workouts', label: 'Начать тренировку' },
  { to: '/workouts/new', label: 'Собрать тренировку' },
  { to: '/nutrition', label: 'Сканировать еду' },
  { to: '/workouts/ai', label: 'Составить с ИИ' },
  { to: '/workouts/chat', label: 'Спросить тренера' },
]

export default function BottomNav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const sheetRef = useRef(null)

  // Меню действий закрываем по Esc и по нажатию мимо: на телефоне это
  // единственный способ уйти назад, не выбирая пункт.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onPointer = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  if (!user) return null

  function go(to) {
    setOpen(false)
    navigate(to)
  }

  return (
    <>
      {open && (
        <div className="bottom-sheet" ref={sheetRef} role="menu" aria-label="Быстрые действия">
          {ACTIONS.map((action) => (
            <button key={action.to} type="button" role="menuitem" onClick={() => go(action.to)}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      <nav className="bottom-nav" aria-label="Основная навигация">
        <NavLink to="/dashboard" className="bottom-nav__item">
          <HomeIcon />
          <span>Обзор</span>
        </NavLink>
        <NavLink to="/workouts" className="bottom-nav__item">
          <DumbbellIcon />
          <span>Тренировки</span>
        </NavLink>

        <button
          type="button"
          className={`bottom-nav__action${open ? ' is-open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Закрыть быстрые действия' : 'Быстрые действия'}
        >
          <span aria-hidden="true">+</span>
        </button>

        <NavLink to="/statistics" className="bottom-nav__item">
          <ChartIcon />
          <span>Статистика</span>
        </NavLink>
        <NavLink to="/profile" className="bottom-nav__item">
          <UserIcon />
          <span>Профиль</span>
        </NavLink>
      </nav>
    </>
  )
}
