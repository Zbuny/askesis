import { useRef } from 'react'

function canTilt() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  return !reduced && hoverCapable
}

export default function TiltCard({ as: Component = 'div', className = '', max = 8, glare = true, children, ...rest }) {
  const ref = useRef(null)

  function apply(rx, ry, lifted) {
    const el = ref.current
    if (!el) return
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(${lifted ? -4 : 0}px)`
  }

  function handleMove(e) {
    if (!canTilt()) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    apply((0.5 - py) * max, (px - 0.5) * max, true)
    if (glare) {
      el.style.setProperty('--glare-x', `${px * 100}%`)
      el.style.setProperty('--glare-y', `${py * 100}%`)
      el.style.setProperty('--glare-opacity', '1')
    }
  }

  function handleEnter() {
    if (!canTilt()) return
    apply(0, 0, true)
  }

  function handleLeave() {
    apply(0, 0, false)
    const el = ref.current
    if (el) el.style.setProperty('--glare-opacity', '0')
  }

  return (
    <Component
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {children}
      {glare && <span className="tilt-card__glare" aria-hidden="true" />}
    </Component>
  )
}
