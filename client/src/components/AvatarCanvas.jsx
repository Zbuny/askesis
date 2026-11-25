import { useEffect, useRef, useState } from 'react'
import { createAvatarScene } from '../three/avatarScene.js'

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// Тонкая обёртка над сценой: создаёт её один раз и пересылает новые данные.
// Сам three.js приезжает только вместе с этим файлом (см. AvatarStage).
export default function AvatarCanvas({ look, growth, pump, highlight = null, onHoverRegion, autoRotate = true }) {
  const hostRef = useRef(null)
  const sceneRef = useRef(null)
  const [failed, setFailed] = useState(() => !supportsWebGL())

  useEffect(() => {
    if (failed) return undefined
    try {
      sceneRef.current = createAvatarScene(hostRef.current, { autoRotate })
    } catch {
      // WebGL выключен или недоступен (старый телефон, режим экономии) —
      // цифры роста всё равно видны рядом, просто без фигуры. Проверка
      // выше ловит почти всё; сюда попадает редкий сбой создания контекста.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true)
    }
    return () => {
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate])

  useEffect(() => {
    if (look) sceneRef.current?.setLook(look)
  }, [look, failed])

  useEffect(() => {
    sceneRef.current?.setGrowth(growth, pump)
  }, [growth, pump, failed])

  useEffect(() => {
    sceneRef.current?.setHighlight(highlight)
  }, [highlight, failed])

  useEffect(() => {
    sceneRef.current?.setOnHover(onHoverRegion || null)
  }, [onHoverRegion, failed])

  if (failed) {
    return (
      <div className="avatar-canvas avatar-canvas--failed">
        <p>Браузер не смог включить 3D. Прогресс по мышцам — в списке рядом.</p>
      </div>
    )
  }

  return <div ref={hostRef} className="avatar-canvas" />
}
