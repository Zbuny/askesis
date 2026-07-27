import { useEffect } from 'react'

const EDGE_PX = 40 // жест начинается только от левого края, как в iOS/Android
const MIN_DISTANCE = 70
const MAX_VERTICAL = 60
const MAX_DURATION_MS = 600

// Свайп от левого края вправо = «назад». Вешаем только на устройствах
// с сенсором: на десктопе для этого есть кнопка.
export function useSwipeBack(onBack) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!window.matchMedia?.('(pointer: coarse)').matches) return undefined

    let startX = 0
    let startY = 0
    let startedAt = 0
    let tracking = false

    function onTouchStart(e) {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      if (touch.clientX > EDGE_PX) return
      startX = touch.clientX
      startY = touch.clientY
      startedAt = Date.now()
      tracking = true
    }

    function onTouchEnd(e) {
      if (!tracking) return
      tracking = false
      const touch = e.changedTouches[0]
      if (!touch) return
      if (Date.now() - startedAt > MAX_DURATION_MS) return
      if (Math.abs(touch.clientY - startY) > MAX_VERTICAL) return
      if (touch.clientX - startX < MIN_DISTANCE) return
      onBack()
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onBack])
}
