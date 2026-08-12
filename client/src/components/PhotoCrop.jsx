import { useRef, useState } from 'react'

// Выделение области на фото перед распознаванием.
//
// Реализовано на pointer-событиях, а не библиотекой: нужен ровно один жест —
// провести прямоугольник, — и тянуть ради него зависимость незачем. Pointer
// events сразу покрывают и мышь, и палец, поэтому отдельной ветки под тач нет.
//
// Координаты держим в долях от размера картинки: обрезается не превью, а
// исходный dataUrl, и его пиксели с экранными не совпадают.

const MIN_FRACTION = 0.08

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

export default function PhotoCrop({ src, onApply, onCancel, busy }) {
  const boxRef = useRef(null)
  const startRef = useRef(null)
  const [area, setArea] = useState(null)

  function pointFrom(event) {
    const rect = boxRef.current.getBoundingClientRect()
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    }
  }

  function handlePointerDown(event) {
    // Захватываем указатель, иначе жест теряется, стоит увести палец за
    // пределы картинки — а именно так и выделяют край тарелки.
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = pointFrom(event)
    setArea(null)
  }

  function handlePointerMove(event) {
    if (!startRef.current) return
    const current = pointFrom(event)
    const start = startRef.current
    setArea({
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    })
  }

  function handlePointerUp() {
    startRef.current = null
    // Случайный тычок вместо жеста — не выделение: сбрасываем, чтобы кнопка
    // не предлагала обрезать фото до точки.
    setArea((prev) => (prev && prev.width >= MIN_FRACTION && prev.height >= MIN_FRACTION ? prev : null))
  }

  return (
    <div className="crop">
      <p className="crop__hint">
        Обведите тарелку — модель оценит только её. Со снимка со всем столом
        калории считаются по всему, что попало в кадр.
      </p>

      <div
        className="crop__frame"
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img src={src} alt="Фото еды" draggable={false} />
        {area && (
          <span
            className="crop__area"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.width * 100}%`,
              height: `${area.height * 100}%`,
            }}
          />
        )}
      </div>

      <div className="crop__actions">
        <button type="button" className="button" onClick={() => onApply(area)} disabled={busy}>
          {busy ? 'Распознаём...' : area ? 'Распознать выделенное' : 'Распознать целиком'}
        </button>
        {area && (
          <button type="button" onClick={() => setArea(null)} disabled={busy}>
            Сбросить выделение
          </button>
        )}
        <button type="button" onClick={onCancel} disabled={busy}>
          Другое фото
        </button>
      </div>
    </div>
  )
}
