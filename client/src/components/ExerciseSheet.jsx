import { useEffect, useRef, useState } from 'react'
import ExercisePicker from './ExercisePicker.jsx'
import '../styles/builder.css'

// Если палец ушёл вниз дальше этого — панель закрывается. Меньше — пружинит
// обратно: случайное касание шапки не должно терять выбор.
const CLOSE_DISTANCE = 110
// Быстрый короткий взмах тоже закрывает (px за мс).
const CLOSE_VELOCITY = 0.6

// Библиотека упражнений нижней панелью поверх конструктора. Раньше она
// стояла под формой, и до неё приходилось листать весь план; теперь её
// открывают кнопкой, отмечают сразу несколько упражнений и возвращаются к
// плану, не уходя со страницы.
//
// Строится на <dialog> с showModal(): браузер сам держит фокус внутри,
// закрывает по Esc и прячет остальную страницу от скринридера. Закрыть
// можно ещё по фону и свайпом вниз за шапку.
export default function ExerciseSheet({ open, exercises, addedIds, picks, onToggle, onSubmit, onClose }) {
  const dialogRef = useRef(null)
  const swipe = useRef(null)
  const pressedBackdrop = useRef(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Модальный <dialog> не мешает прокрутке страницы под ним (на телефоне
  // она «просвечивает» сквозь панель), поэтому на время показа её глушим.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Esc закрывает <dialog> мимо React — перехватываем и закрываем сами,
    // чтобы состояние снаружи не разошлось с тем, что на экране.
    const handleCancel = (event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  // Клик по фону: у модального <dialog> фон — это ::backdrop, а событие
  // приходит на сам dialog. Проверяем и нажатие, и отпускание: иначе
  // выделение текста в панели, отпущенное за её краем, закрыло бы её.
  function handlePointerDown(e) {
    pressedBackdrop.current = e.target === dialogRef.current
  }

  function handleClick(e) {
    if (pressedBackdrop.current && e.target === dialogRef.current) onClose()
    pressedBackdrop.current = false
  }

  function startSwipe(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('button')) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // без захвата свайп всё равно доходит, пока палец над шапкой
    }
    swipe.current = { startY: e.clientY, startTime: e.timeStamp, dy: 0 }
  }

  function moveSwipe(e) {
    const s = swipe.current
    if (!s) return
    s.dy = Math.max(0, e.clientY - s.startY)
    setOffset(s.dy)
  }

  function endSwipe(e) {
    const s = swipe.current
    if (!s) return
    swipe.current = null
    const velocity = s.dy / Math.max(1, e.timeStamp - s.startTime)
    setOffset(0)
    if (s.dy > CLOSE_DISTANCE || (s.dy > 30 && velocity > CLOSE_VELOCITY)) onClose()
  }

  const count = picks.length

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="exercise-sheet-title"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <div
        className={`sheet__panel${offset ? ' is-swiping' : ''}`}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      >
        <div
          className="sheet__head"
          onPointerDown={startSwipe}
          onPointerMove={moveSwipe}
          onPointerUp={endSwipe}
          onPointerCancel={endSwipe}
        >
          <span className="sheet__grabber" aria-hidden="true" />
          <h2 id="exercise-sheet-title" className="sheet__title">Библиотека упражнений</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Закрыть библиотеку">
            ✕
          </button>
        </div>

        <div className="sheet__body">
          {open && (
            <ExercisePicker
              exercises={exercises}
              addedIds={addedIds}
              picks={picks}
              onToggle={onToggle}
              title={null}
            />
          )}
        </div>

        <div className="sheet__foot">
          <button type="button" className="button--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" onClick={onSubmit} disabled={count === 0}>
            {count ? `Добавить (${count})` : 'Отметьте упражнения'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
