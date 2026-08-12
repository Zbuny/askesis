import { useEffect, useRef, useState } from 'react'

// Число, которое добегает до значения вместо того, чтобы просто появиться.
//
// Нужно ровно в одном месте — XP за только что записанную тренировку. Смысл
// не в украшении: цифра, выросшая на глазах, читается как следствие того,
// что человек сейчас сделал, а не как ещё одно число на экране.
//
// prefers-reduced-motion уважаем без обсуждений: для части людей движение на
// экране — это тошнота и головная боль, и «зато красиво» тут не аргумент.
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target)
  const frame = useRef(0)

  useEffect(() => {
    const end = Number(target) || 0
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

    // В скрытой вкладке requestAnimationFrame не вызывается вовсе: анимация
    // не «идёт медленно», а не начинается, и число навсегда осталось бы на
    // нуле. Там сразу показываем результат.
    if (reduced || end <= 0 || (typeof document !== 'undefined' && document.hidden)) {
      setValue(end)
      return undefined
    }

    const started = performance.now()
    setValue(0)

    const tick = (now) => {
      const passed = Math.min(1, (now - started) / duration)
      // Замедление к концу: равномерный счёт выглядит механическим.
      const eased = 1 - (1 - passed) ** 3
      setValue(Math.round(end * eased))
      if (passed < 1) frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    // Страховка на случай, если кадры перестанут приходить по дороге —
    // вкладку свернули, система прижала фоновую отрисовку. Итоговое число
    // важнее анимации, и потерять его нельзя.
    const settle = setTimeout(() => setValue(end), duration + 150)

    return () => {
      cancelAnimationFrame(frame.current)
      clearTimeout(settle)
    }
  }, [target, duration])

  return value
}
