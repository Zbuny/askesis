import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

// Рантайм Spline весит больше мегабайта чанками, а блок стоит в середине
// статистики — до него доскроллит не каждый. Поэтому сцена монтируется
// только когда попадает в кадр: страница с цифрами не платит за 3D вперёд.
export default function SplineScene({ scene, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="spline-scene__mount">
      {visible ? (
        <Suspense fallback={<SplineFallback />}>
          <Spline scene={scene} className={className} />
        </Suspense>
      ) : (
        <SplineFallback />
      )}
    </div>
  )
}

function SplineFallback() {
  return (
    <div className="spline-scene__fallback">
      <span className="spline-scene__loader" aria-hidden="true" />
    </div>
  )
}
