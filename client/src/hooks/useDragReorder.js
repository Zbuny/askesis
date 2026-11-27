import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dropIndex, edgeScrollSpeed } from '../utils/reorder.js'

// Перестановка пунктов списка перетаскиванием за ручку.
//
// Своя реализация, а не библиотека (@dnd-kit и т.п.): нужен один
// вертикальный список с одной ручкой, и это ~150 строк на Pointer Events —
// они одинаково приходят от мыши, пальца и стилуса. Библиотека принесла бы
// десятки килобайт ради того же самого.
//
// Как устроено:
// - жест начинается только с ручки: у неё touch-action: none, а у самой
//   строки — нет, поэтому палец на строке по-прежнему прокручивает страницу;
// - пока идёт жест, список не переставляется — перетаскиваемый пункт и
//   соседи только сдвигаются transform-ом, а в конце жеста вызывается
//   onMove(from, to) один раз;
// - у верхнего и нижнего края экрана страница сама прокручивается;
// - с клавиатуры: фокус на ручке, стрелки вверх/вниз двигают пункт, Esc
//   отменяет перетаскивание мышью/пальцем.
export function useDragReorder({ ids, onMove, labelOf }) {
  const rows = useRef(new Map())
  const handles = useRef(new Map())
  const gesture = useRef(null)
  const refocus = useRef(null)
  const [drag, setDrag] = useState(null)
  const [announcement, setAnnouncement] = useState('')

  const update = useCallback(() => {
    const g = gesture.current
    if (!g) return
    const pageY = g.clientY + window.scrollY
    const targetIndex = dropIndex(g.middles, g.fromIndex, pageY)
    setDrag((prev) => prev && { ...prev, y: pageY - g.startPageY, targetIndex })
  }, [])

  const finish = useCallback(
    (commit) => {
      const g = gesture.current
      if (!g) return
      gesture.current = null
      setDrag(null)
      if (!commit) return
      const pageY = g.clientY + window.scrollY
      const to = dropIndex(g.middles, g.fromIndex, pageY)
      if (to !== g.fromIndex) {
        onMove(g.fromIndex, to)
        setAnnouncement(`${labelOf(g.id)}: позиция ${to + 1} из ${g.middles.length}`)
      }
    },
    [labelOf, onMove],
  )

  // Автопрокрутка: пока палец держат у края, крутим страницу каждый кадр
  // и пересчитываем цель — сам pointermove в это время не приходит.
  const dragging = Boolean(drag)
  useEffect(() => {
    if (!dragging) return
    let frame = 0
    const tick = () => {
      const g = gesture.current
      if (!g) return
      const speed = edgeScrollSpeed(g.clientY, window.innerHeight)
      if (speed) {
        window.scrollBy(0, speed)
        update()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [dragging, update])

  // После перестановки с клавиатуры React переносит DOM-узел, и фокус с
  // ручки слетает. Возвращаем его, чтобы можно было жать стрелку дальше.
  useLayoutEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    handles.current.get(id)?.focus()
  }, [ids])

  function rowRef(id) {
    return (el) => {
      if (el) rows.current.set(id, el)
      else rows.current.delete(id)
    }
  }

  function handleProps(id, index) {
    return {
      ref: (el) => {
        if (el) handles.current.set(id, el)
        else handles.current.delete(id)
      },
      onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const row = rows.current.get(id)
        if (!row) return
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // синтетические события без живого указателя — тащим и без захвата
        }
        const scrollY = window.scrollY
        const middles = ids.map((otherId) => {
          const el = rows.current.get(otherId)
          if (!el) return 0
          const rect = el.getBoundingClientRect()
          return rect.top + scrollY + rect.height / 2
        })
        gesture.current = { id, fromIndex: index, clientY: e.clientY, startPageY: e.clientY + scrollY, middles }
        // Шаг сдвига соседей — высота строки плюс зазор между строками списка.
        const gap = parseFloat(getComputedStyle(row.parentElement).rowGap) || 0
        setDrag({ id, fromIndex: index, targetIndex: index, y: 0, height: row.offsetHeight + gap })
      },
      onPointerMove(e) {
        const g = gesture.current
        if (!g || g.id !== id) return
        g.clientY = e.clientY
        update()
      },
      onPointerUp() {
        finish(true)
      },
      onPointerCancel() {
        finish(false)
      },
      onLostPointerCapture() {
        finish(true)
      },
      onKeyDown(e) {
        if (gesture.current && e.key === 'Escape') {
          e.preventDefault()
          finish(false)
          return
        }
        const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
        if (!step) return
        e.preventDefault()
        const to = index + step
        if (to < 0 || to >= ids.length) return
        refocus.current = id
        onMove(index, to)
        setAnnouncement(`${labelOf(id)}: позиция ${to + 1} из ${ids.length}`)
      },
    }
  }

  // Стиль строки на время жеста: перетаскиваемая едет за пальцем, соседи
  // между старым и новым местом расступаются на её высоту.
  function rowStyle(id, index) {
    if (!drag) return undefined
    if (drag.id === id) return { transform: `translateY(${drag.y}px)` }
    const offset = drag.height
    if (drag.fromIndex > drag.targetIndex && index >= drag.targetIndex && index < drag.fromIndex) {
      return { transform: `translateY(${offset}px)` }
    }
    if (drag.fromIndex < drag.targetIndex && index > drag.fromIndex && index <= drag.targetIndex) {
      return { transform: `translateY(-${offset}px)` }
    }
    return undefined
  }

  return { drag, rowRef, handleProps, rowStyle, announcement }
}
