import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const HomeIcon = () => (
  <svg {...iconProps}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
)
const ProgramsIcon = () => (
  <svg {...iconProps}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M3 10h5M3 15h5" /></svg>
)
const ExercisesIcon = () => (
  <svg {...iconProps}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>
)
const WorkoutsIcon = () => (
  <svg {...iconProps}><path d="M12 20V10M6 20v-6M18 20V4" /></svg>
)
const ProfileIcon = () => (
  <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
)
const LoginIcon = () => (
  <svg {...iconProps}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
)

// Нижняя навигация для телефонов: пять целей на расстоянии большого пальца.
// Активный пункт подсвечивается лучом сверху, который переезжает между
// иконками — позиция считается по реальной геометрии, а не по индексу,
// потому что число пунктов зависит от того, вошёл ли пользователь.
export default function MobileNav() {
  const { user } = useAuth()
  const location = useLocation()
  const itemRefs = useRef([])
  const beamRef = useRef(null)
  const [ready, setReady] = useState(false)

  const items = user
    ? [
        { to: '/', icon: <HomeIcon />, label: 'Главная', end: true },
        { to: '/programs', icon: <ProgramsIcon />, label: 'Программы' },
        { to: '/exercises', icon: <ExercisesIcon />, label: 'Упражнения' },
        { to: '/workouts', icon: <WorkoutsIcon />, label: 'Тренировки' },
        { to: '/profile', icon: <ProfileIcon />, label: 'Профиль' },
      ]
    : [
        { to: '/', icon: <HomeIcon />, label: 'Главная', end: true },
        { to: '/programs', icon: <ProgramsIcon />, label: 'Программы' },
        { to: '/exercises', icon: <ExercisesIcon />, label: 'Упражнения' },
        { to: '/login', icon: <LoginIcon />, label: 'Войти' },
      ]

  const activeIndex = items.reduce((found, item, i) => {
    if (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)) {
      // Более длинный путь точнее: /workouts выигрывает у / для /workouts/ai.
      if (found === -1 || item.to.length > items[found].to.length) return i
    }
    return found
  }, -1)

  useLayoutEffect(() => {
    const beam = beamRef.current
    const active = itemRefs.current[activeIndex]
    if (!beam) return

    if (!active) {
      beam.style.opacity = '0'
      return
    }

    beam.style.opacity = '1'
    beam.style.left = `${active.offsetLeft + active.offsetWidth / 2 - beam.offsetWidth / 2}px`

    // Первую установку делаем без анимации, иначе луч приезжает из угла.
    if (!ready) {
      const id = setTimeout(() => setReady(true), 60)
      return () => clearTimeout(id)
    }
    return undefined
  }, [activeIndex, ready, items.length])

  return (
    <nav className="mobile-nav" aria-label="Основная навигация">
      <div className="mobile-nav__inner">
        {items.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            className={({ isActive }) => `mobile-nav__item ${isActive ? 'active' : ''}`}
            aria-label={item.label}
          >
            <span className="mobile-nav__icon">{item.icon}</span>
            <span className="mobile-nav__label">{item.label}</span>
          </NavLink>
        ))}

        <div ref={beamRef} className={`mobile-nav__beam ${ready ? 'is-ready' : ''}`} aria-hidden="true">
          <span className="mobile-nav__cone" />
        </div>
      </div>
    </nav>
  )
}
