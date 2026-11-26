// Сцена с персонажем: рендерер, свет, подиум, вращение мышью/пальцем,
// подсказка по наведению на мышцу и плавный рост.
//
// Живёт отдельно от React: компонент только создаёт сцену и передаёт ей
// новые данные через set*-методы. Так пересборка экрана не пересоздаёт
// WebGL-контекст, а одежда меняется без мигания.

import * as THREE from 'three'
import { createFigure } from './figure.js'
import { createModelFigure } from './modelFigure.js'
import { loadCharacterModel } from './modelLoader.js'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createAvatarScene(host, { autoRotate = true, interactive = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.domElement.className = 'avatar-canvas__gl'
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  camera.position.set(0, 1.08, 4.1)
  camera.lookAt(0, 0.93, 0)

  scene.add(new THREE.HemisphereLight(0xf4efe6, 0x1a1712, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(2.2, 3.2, 3)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xbfc8ff, 0.55)
  fill.position.set(-3, 1.5, 2)
  scene.add(fill)
  // Золотой контровой свет — тот же акцент, что во всём интерфейсе; он же
  // обрисовывает силуэт, и рост мышц читается по контуру.
  const rim = new THREE.DirectionalLight(0xd8bb84, 2.6)
  rim.position.set(-1.5, 2.4, -3)
  scene.add(rim)

  const ownedGeometries = []
  const ownedMaterials = []

  const shadowMap = shadowTexture()
  const shadowGeo = new THREE.CircleGeometry(0.5, 48)
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.002
  scene.add(shadow)

  const ringGeo = new THREE.RingGeometry(0.56, 0.566, 96)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd8bb84, transparent: true, opacity: 0.22 })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.001
  scene.add(ring)
  ownedGeometries.push(shadowGeo, ringGeo)
  ownedMaterials.push(shadowMat, ringMat)

  const pivot = new THREE.Group()
  pivot.rotation.y = -0.35
  scene.add(pivot)

  const reduced = prefersReducedMotion()
  // Объявлены до первого resize(): тот сразу просит кадр.
  let raf = 0
  let disposed = false
  const state = {
    figure: null,
    growthTarget: {},
    growth: {},
    pump: {},
    highlight: null,
    hovered: null,
    autoRotate: autoRotate && !reduced,
    dragging: false,
    lastX: 0,
    velocity: 0,
    idleSince: 0,
    visible: true,
    onHover: null,
  }

  // Отладка в режиме разработки: сцена доступна из консоли как __avatar.
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__avatar = { state, scene, camera, pivot }

  function swapFigure(figure) {
    if (state.figure) {
      pivot.remove(state.figure.root)
      state.figure.dispose()
    }
    state.figure = figure
    pivot.add(figure.root)
    requestFrame()
  }

  // Модель (~4 МБ) грузится один раз на фигуру. Пока её нет — гладкая
  // процедурная фигура; если загрузка не удалась, она так и остаётся.
  let lookVersion = 0
  function setLook(look) {
    const version = ++lookVersion
    const models = state.models || (state.models = {})
    if (models[look.body]) {
      swapFigure(createModelFigure(models[look.body], look))
      return
    }
    if (!state.figure || state.figure.procedural !== look.body) {
      const figure = createFigure(look)
      figure.procedural = look.body
      swapFigure(figure)
    }
    loadCharacterModel(look.body)
      .then((gltf) => {
        models[look.body] = gltf
        if (disposed || version !== lookVersion) return
        swapFigure(createModelFigure(gltf, look))
      })
      .catch(() => {
        // Нет сети или файла — остаётся процедурная фигура, но в актуальной одежде.
        if (disposed || version !== lookVersion) return
        const figure = createFigure(look)
        figure.procedural = look.body
        swapFigure(figure)
      })
  }

  function setGrowth(growth = {}, pump = {}) {
    state.growthTarget = { ...growth }
    state.pump = { ...pump }
    if (reduced) state.growth = { ...growth }
    requestFrame()
  }

  function setHighlight(region) {
    state.highlight = region || null
    requestFrame()
  }

  function setOnHover(callback) {
    state.onHover = callback
  }

  // ---------- размер ----------

  function resize() {
    const width = host.clientWidth || 1
    const height = host.clientHeight || 1
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // На узком экране отъезжаем, чтобы фигура целиком помещалась по ширине.
    camera.position.z = camera.aspect < 0.62 ? 4.1 * (0.62 / camera.aspect) ** 0.6 : 4.1
    camera.updateProjectionMatrix()
    requestFrame()
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(host)
  resize()

  // ---------- вращение и наведение ----------

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const canvas = renderer.domElement

  function pick(event) {
    if (!state.figure) return null
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(state.figure.pickables, false)[0]
    if (!hit) return null
    const { regionOf, region } = hit.object.userData
    return (regionOf ? regionOf(hit) : region) || null
  }

  function setHovered(region) {
    if (state.hovered === region) return
    state.hovered = region
    state.onHover?.(region)
    requestFrame()
  }

  function onPointerDown(event) {
    state.dragging = true
    state.lastX = event.clientX
    state.velocity = 0
    canvas.setPointerCapture?.(event.pointerId)
  }
  function onPointerMove(event) {
    if (state.dragging) {
      const dx = event.clientX - state.lastX
      state.lastX = event.clientX
      pivot.rotation.y += dx * 0.012
      state.velocity = dx * 0.012
      state.idleSince = performance.now()
      requestFrame()
      return
    }
    if (event.pointerType === 'mouse') setHovered(pick(event))
  }
  function onPointerUp(event) {
    if (!state.dragging) return
    state.dragging = false
    state.idleSince = performance.now()
    canvas.releasePointerCapture?.(event.pointerId)
    // Тап без сдвига на телефоне — это «покажи, что за мышца».
    if (event.pointerType !== 'mouse' && Math.abs(state.velocity) < 0.002) setHovered(pick(event))
  }
  function onPointerLeave() {
    if (!state.dragging) setHovered(null)
  }

  if (interactive) {
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
  }

  // ---------- цикл ----------

  // Рисуем только пока сцена на экране и вкладка активна: персонаж в
  // середине длинной страницы не должен греть телефон в кармане.
  const intersection =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          state.visible = entry.isIntersecting
          if (state.visible) requestFrame()
        })
      : null
  intersection?.observe(host)
  const onVisibility = () => requestFrame()
  document.addEventListener('visibilitychange', onVisibility)

  const clock = new THREE.Clock()

  function needsMotion() {
    if (reduced) return false
    return true
  }

  function requestFrame() {
    if (disposed || raf) return
    raf = requestAnimationFrame(frame)
  }

  function frame() {
    raf = 0
    if (disposed || !state.visible || document.hidden) return
    const dt = Math.min(clock.getDelta(), 0.1)
    const time = clock.elapsedTime

    // Рост догоняет цель плавно — при загрузке мышцы «наливаются».
    let settling = false
    Object.keys(state.growthTarget).forEach((region) => {
      const target = state.growthTarget[region]
      const current = state.growth[region] ?? 0
      const next = current + (target - current) * Math.min(1, dt * 2.2)
      state.growth[region] = Math.abs(target - next) < 0.0005 ? target : next
      if (state.growth[region] !== target) settling = true
    })

    if (!state.dragging) {
      if (Math.abs(state.velocity) > 0.0005) {
        pivot.rotation.y += state.velocity
        state.velocity *= 0.92
      } else if (state.autoRotate && performance.now() - state.idleSince > 2500) {
        pivot.rotation.y += dt * 0.35
      }
    }

    const pending = state.figure?.update({
      growth: state.growth,
      pump: state.pump,
      highlight: state.highlight || state.hovered,
      time,
    })
    renderer.render(scene, camera)

    if (needsMotion() || settling || pending || Math.abs(state.velocity) > 0.0005) requestFrame()
  }

  requestFrame()

  function dispose() {
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    resizeObserver?.disconnect()
    intersection?.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    if (interactive) {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
    state.figure?.dispose()
    ownedGeometries.forEach((g) => g.dispose())
    ownedMaterials.forEach((m) => m.dispose())
    shadowMap.dispose()
    renderer.dispose()
    renderer.forceContextLoss?.()
    canvas.remove()
  }

  return { setLook, setGrowth, setHighlight, setOnHover, dispose }
}
