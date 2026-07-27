import { useEffect, useRef, useState } from 'react'
import { exerciseFrames } from '../utils/exerciseFrames.js'

const FRAME_MS = 900

// Датасет даёт два кадра на упражнение — начало и конец движения.
// Пролистывая их по кругу, получаем ту же демонстрацию техники, что и гифка,
// но без внешних гиф-хостингов и лишнего веса.
export default function ExerciseAnimation({ exercise, alt, animate = true, className = '' }) {
  const frames = exerciseFrames(exercise)
  const [index, setIndex] = useState(0)
  const [secondFrameOk, setSecondFrameOk] = useState(true)
  const timerRef = useRef(null)

  const canAnimate = animate && frames.length > 1 && secondFrameOk

  useEffect(() => {
    setIndex(0)
    if (!canAnimate) return undefined

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS)
    return () => clearInterval(timerRef.current)
  }, [canAnimate, frames.length, frames[0]])

  if (frames.length === 0) return null

  // Второй кадр монтируем только когда он реально нужен: в сетке из сотен
  // карточек лишний <img> на каждую удваивает число картинок, и браузер
  // перестаёт догружать даже видимые.
  const rendered = canAnimate ? frames : frames.slice(0, 1)

  return (
    <span className={`exercise-anim ${className}`.trim()}>
      {rendered.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ''}
          aria-hidden={i === 0 ? undefined : true}
          loading="lazy"
          className={i === index ? 'is-visible' : ''}
          onError={i === 1 ? () => setSecondFrameOk(false) : undefined}
        />
      ))}
    </span>
  )
}
