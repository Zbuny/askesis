import { createContext, useContext, useCallback, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'askesis:theme'

function getInitialTheme() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored === 'light' || stored === 'dark') return stored
  const prefersLight = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // Цвет строки состояния у установленного приложения — по выбранной теме,
    // а не по системной: иначе светлая тема получает чёрную полосу сверху.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', theme === 'light' ? '#f5f4f0' : '#08080a')
    })
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Приватный режим — тема просто не запомнится.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
