import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const AvatarCanvas = lazy(() => import('./AvatarCanvas.jsx'))

// three.js весит заметно, а персонаж на статистике стоит не в первом
// экране. Поэтому сцена грузится и монтируется, только когда блок
// подъезжает к кадру: страница с цифрами не платит за 3D вперёд.
export default function AvatarStage(props) {
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
    <div ref={ref} className="avatar-stage">
      {visible ? (
        <Suspense fallback={<AvatarFallback />}>
          <AvatarCanvas {...props} />
        </Suspense>
      ) : (
        <AvatarFallback />
      )}
    </div>
  )
}

function AvatarFallback() {
  return (
    <div className="avatar-stage__fallback">
      <span className="avatar-stage__loader" aria-hidden="true" />
    </div>
  )
}
