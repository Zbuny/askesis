import { createContext, useContext, useCallback, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'askesis:theme'

// Оформления приложения. Основное — современное, в тёмной или светлой
// схеме; «Киберпанк» — отдельная тема, только тёмная. Значение одно на
// <html data-theme>: правила светлой схемы в index.css смотрят на 'light',
// всё остальное наследует тёмную основу, а киберпанк добавляет поверх свою.
const THEMES = ['dark', 'light', 'cyber']

const THEME_COLOR = { dark: '#08080a', light: '#f5f4f0', cyber: '#050505' }

// Шрифты киберпанка нужны только ему: грузим их, когда тему включили,
// а не на каждом первом визите.
const CYBER_FONTS_ID = 'askesis-cyber-fonts'
const CYBER_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Oswald:wght@500;600;700&display=swap'

function getInitialTheme() {
  let stored = null
  try {
    stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  } catch {
    // Хранилище недоступно — берём системную схему.
  }
  if (THEMES.includes(stored)) return stored
  const prefersLight = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

function ensureCyberFonts() {
  if (typeof document === 'undefined' || document.getElementById(CYBER_FONTS_ID)) return
  const link = document.createElement('link')
  link.id = CYBER_FONTS_ID
  link.rel = 'stylesheet'
  link.href = CYBER_FONTS_HREF
  document.head.appendChild(link)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === 'cyber') ensureCyberFonts()
    // Цвет строки состояния у установленного приложения — по выбранной теме,
    // а не по системной: иначе светлая тема получает чёрную полосу сверху.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR.dark)
    })
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Приватный режим — тема просто не запомнится.
    }
  }, [theme])

  const setTheme = useCallback((next) => {
    if (THEMES.includes(next)) setThemeState(next)
  }, [])

  // Кнопка в шапке переключает только схему современной темы. Киберпанк
  // включают и выключают в профиле, поэтому из него кнопка ведёт в светлую,
  // как из тёмной.
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
