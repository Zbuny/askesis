import { useEffect, useRef, useState } from 'react'

function canAnimate() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function Spotlight({ className = '', size = 260 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!parent || !canAnimate()) return

    const prevPosition = parent.style.position
    const prevOverflow = parent.style.overflow
    if (!prevPosition || prevPosition === 'static') parent.style.position = 'relative'
    parent.style.overflow = 'hidden'

    function handleMove(e) {
      const rect = parent.getBoundingClientRect()
      el.style.setProperty('--spotlight-x', `${e.clientX - rect.left - size / 2}px`)
      el.style.setProperty('--spotlight-y', `${e.clientY - rect.top - size / 2}px`)
    }
    function handleEnter() {
      setVisible(true)
    }
    function handleLeave() {
      setVisible(false)
    }

    parent.addEventListener('mousemove', handleMove)
    parent.addEventListener('mouseenter', handleEnter)
    parent.addEventListener('mouseleave', handleLeave)
    return () => {
      parent.removeEventListener('mousemove', handleMove)
      parent.removeEventListener('mouseenter', handleEnter)
      parent.removeEventListener('mouseleave', handleLeave)
      parent.style.position = prevPosition
      parent.style.overflow = prevOverflow
    }
  }, [size])

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`spotlight ${visible ? 'spotlight--visible' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
