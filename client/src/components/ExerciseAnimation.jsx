import { useEffect, useRef, useState } from 'react'
import { exerciseAnimationUrl, exerciseFrames } from '../utils/exerciseFrames.js'

const FRAME_MS = 900

// Демонстрация техники. Два пути, и выбор между ними — это данные, а не код.
//
// Если у упражнения заполнено animationUrl, показываем готовую анимацию: её
// браузер крутит сам, и никакой логики кадров не нужно. Если нет — работает
// прежняя перелистовка двух кадров из Free Exercise DB. Датасет даёт ровно
// два кадра на упражнение, и никакие настройки времени не сделают из них
// гифку, поэтому докладывать анимации можно по одной, по мере появления.
export default function ExerciseAnimation({ exercise, alt, animate = true, className = '' }) {
  const animation = exerciseAnimationUrl(exercise)
  const frames = exerciseFrames(exercise)
  const [index, setIndex] = useState(0)
  const [secondFrameOk, setSecondFrameOk] = useState(true)
  const [animationOk, setAnimationOk] = useState(true)
  const timerRef = useRef(null)

  // Битая ссылка на анимацию не должна оставлять пустое место: откатываемся
  // на кадры, которые есть у каждого упражнения каталога.
  const useAnimation = Boolean(animation) && animationOk
  const canAnimate = !useAnimation && animate && frames.length > 1 && secondFrameOk

  useEffect(() => {
    setAnimationOk(true)
  }, [animation])

  useEffect(() => {
    setIndex(0)
    if (!canAnimate) return undefined

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS)
    return () => clearInterval(timerRef.current)
  }, [canAnimate, frames.length, frames[0]])

  if (useAnimation) {
    return (
      <span className={`exercise-anim ${className}`.trim()}>
        <img
          src={animation}
          alt={alt}
          loading="lazy"
          className="is-visible"
          onError={() => setAnimationOk(false)}
        />
      </span>
    )
  }

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
