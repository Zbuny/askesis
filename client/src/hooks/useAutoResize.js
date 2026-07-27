import { useCallback, useEffect, useRef } from 'react'

// Поле растёт под текст, но не выше maxHeight — дальше появляется скролл.
export function useAutoResize({ minHeight = 60, maxHeight = 200 } = {}) {
  const ref = useRef(null)

  const adjust = useCallback(
    (reset) => {
      const el = ref.current
      if (!el) return
      el.style.height = `${minHeight}px`
      if (reset) return
      el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`
    },
    [minHeight, maxHeight],
  )

  useEffect(() => {
    adjust()
    window.addEventListener('resize', adjust)
    return () => window.removeEventListener('resize', adjust)
  }, [adjust])

  return { ref, adjust }
}
