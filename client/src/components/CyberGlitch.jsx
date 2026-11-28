import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext.jsx'
import { hasDigits, nextDelay, scrambleDigits } from '../utils/glitch.js'

// Глитч темы «Киберпанк». Один компонент на всё приложение, чтобы страницы
// о нём не знали: он сам находит заголовки и цифры в DOM и вешает на них
// короткие классы, а вид эффекта целиком в styles/theme-cyber.css.
//
// Почему JS, а не бесконечные CSS-анимации на каждом заголовке: вспышка
// живёт 300 мс и только у одного элемента за раз, остальное время ничего
// не анимируется и телефон не тратит на это кадры. Дубли текста для срезов
// появляются в ::before/::after только на время вспышки (content с пустым
// альтернативным текстом, чтобы читалка не произнесла заголовок трижды).
//
// Правила безопасности: не чаще одной вспышки в секунду на элемент и не
// больше трёх смен кадра во вспышке (порог светочувствительной эпилепсии —
// три вспышки в секунду), только transform/opacity/clip-path, а при
// prefers-reduced-motion компонент не делает ничего.

const HEADINGS = '.content h1, .content .page-head h2, .navbar__logo'
const STRONG = '.not-found h1, .empty-state--error h3'
const NUMBERS = [
  '.stat-tile strong',
  '.level-row__info strong',
  '.level-row__xp',
  '.streak-card strong',
  '.record-card strong',
  '.record-card__gain',
  '.ring__value',
  '.muscle-bar__value',
  '.stat-card strong',
  '.review__stat strong',
  '.hero__meta strong',
  '.progress-chart__value',
  '.spline-showcase__title',
  '.character__badge :is(strong, em)',
].join(', ')

const BURST_MS = 320
const HOVER_COOLDOWN_MS = 1200
const SCRAMBLE_MS = 450

function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined
    const media = matchMedia(query)
    const onChange = () => setReduced(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

// Слой-«удар»: перезапуск анимации без чтения layout — снимаем класс и
// ставим его в следующем кадре.
function flash(el, className, ms, timers) {
  if (!el) return
  el.classList.remove(className)
  requestAnimationFrame(() => {
    el.classList.add(className)
    const id = setTimeout(() => {
      el.classList.remove(className)
      timers.delete(id)
    }, ms)
    timers.add(id)
  })
}

// Вспышка одного элемента. data-text берём в момент вспышки: заголовки с
// именем и приветствием меняются, и запомненный заранее текст устарел бы.
function burst(el, timers) {
  if (!el || el.classList.contains('is-glitching')) return
  if (!el.classList.contains('navbar__logo')) {
    el.dataset.text = el.innerText.trim()
  }
  el.classList.toggle('is-glitching--alt', Math.random() < 0.5)
  el.classList.add('is-glitching')
  const id = setTimeout(() => {
    el.classList.remove('is-glitching', 'is-glitching--alt')
    timers.delete(id)
  }, BURST_MS)
  timers.add(id)
}

function inViewport(el) {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight
}

export default function CyberGlitch() {
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const active = theme === 'cyber' && !reduced
  const hitRef = useRef(null)
  const noiseRef = useRef(null)
  const timers = useRef(new Set())

  // Редкие вспышки заголовков и помехи по фону.
  useEffect(() => {
    if (!active) return undefined
    let headingTimer = 0
    let noiseTimer = 0
    const pending = timers.current

    const loopHeading = () => {
      headingTimer = setTimeout(() => {
        if (!document.hidden) {
          const visible = [...document.querySelectorAll(HEADINGS)].filter(inViewport)
          if (visible.length) burst(visible[Math.floor(Math.random() * visible.length)], pending)
        }
        loopHeading()
      }, nextDelay(4500, 8500))
    }

    const loopNoise = () => {
      noiseTimer = setTimeout(() => {
        const band = noiseRef.current
        if (band && !document.hidden) {
          band.style.setProperty('--noise-y', `${nextDelay(8, 88)}vh`)
          band.style.setProperty('--noise-h', `${nextDelay(3, 14)}px`)
          flash(band, 'is-on', 200, pending)
        }
        loopNoise()
      }, nextDelay(9000, 17000))
    }

    // Наведение: тот же сбой, но не чаще раза в 1,2 с на элемент, чтобы
    // движение мыши туда-сюда не превращалось в мигание.
    const lastHover = new WeakMap()
    const onOver = (event) => {
      if (event.pointerType === 'touch') return
      const el = event.target.closest?.(HEADINGS)
      if (!el || el.contains(event.relatedTarget)) return
      const now = performance.now()
      if (now - (lastHover.get(el) || 0) < HOVER_COOLDOWN_MS) return
      lastHover.set(el, now)
      burst(el, pending)
    }

    loopHeading()
    loopNoise()
    document.addEventListener('pointerover', onOver)
    return () => {
      clearTimeout(headingTimer)
      clearTimeout(noiseTimer)
      document.removeEventListener('pointerover', onOver)
      pending.forEach(clearTimeout)
      pending.clear()
      document.querySelectorAll('.is-glitching').forEach((el) => {
        el.classList.remove('is-glitching', 'is-glitching--alt')
      })
    }
  }, [active])

  // Сильный глитч на ошибках и 404 и «перебор» цифр при первом появлении.
  // Страницы грузятся лениво, а данные приходят позже разметки, поэтому
  // следим за #main и досматриваем новые узлы с небольшой задержкой.
  useEffect(() => {
    if (!active) return undefined
    const main = document.getElementById('main')
    if (!main) return undefined
    const seen = new WeakSet()
    const running = new Set()

    const scramble = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes = []
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (hasDigits(node.nodeValue)) nodes.push({ node, original: node.nodeValue, written: node.nodeValue })
      }
      if (!nodes.length) return
      const started = performance.now()
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / SCRAMBLE_MS)
        nodes.forEach((entry) => {
          // React успел обновить число — его значение главнее, отходим.
          if (entry.node.nodeValue !== entry.written) {
            entry.done = true
            return
          }
          if (entry.done) return
          entry.written = progress >= 1 ? entry.original : scrambleDigits(entry.original, progress)
          entry.node.nodeValue = entry.written
        })
        if (progress < 1) running.add(requestAnimationFrame(throttled))
      }
      // Кадр ~30 раз в секунду: смена цифр, а не вспышка, и дешевле на слабых
      // телефонах, чем перерисовка каждые 16 мс.
      let last = 0
      const throttled = (now) => {
        if (now - last >= 33 || now - started >= SCRAMBLE_MS) {
          last = now
          tick(now)
          return
        }
        running.add(requestAnimationFrame(throttled))
      }
      running.add(requestAnimationFrame(throttled))
      // Если кадры не придут (вкладку свернули), число всё равно станет верным.
      const id = setTimeout(() => {
        nodes.forEach((entry) => {
          if (!entry.done && entry.node.nodeValue === entry.written) entry.node.nodeValue = entry.original
        })
      }, SCRAMBLE_MS + 200)
      timers.current.add(id)
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        io.unobserve(entry.target)
        if (!document.hidden) scramble(entry.target)
      })
    })

    const scan = () => {
      main.querySelectorAll(STRONG).forEach((el) => {
        const text = el.textContent.trim()
        if (el.dataset.text !== text) el.dataset.text = text
        el.classList.add('glitch-strong')
      })
      main.querySelectorAll(NUMBERS).forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    }

    let scanTimer = 0
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer)
      scanTimer = setTimeout(scan, 120)
    })
    observer.observe(main, { childList: true, subtree: true })
    scan()

    return () => {
      observer.disconnect()
      io.disconnect()
      clearTimeout(scanTimer)
      running.forEach(cancelAnimationFrame)
      main.querySelectorAll('.glitch-strong').forEach((el) => el.classList.remove('glitch-strong'))
    }
  }, [active])

  // Переход между страницами: короткий «удар» помех и сбой нового заголовка,
  // когда ленивая страница успеет его нарисовать.
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (!active || lastPath.current === pathname) return undefined
    lastPath.current = pathname
    flash(hitRef.current, 'is-on', 240, timers.current)
    const id = setTimeout(() => {
      const heading = document.querySelector('.content h1')
      if (heading && inViewport(heading)) burst(heading, timers.current)
    }, 380)
    timers.current.add(id)
    return () => clearTimeout(id)
  }, [pathname, active])

  if (!active) return null
  return (
    <>
      <div ref={hitRef} className="cyber-hit" aria-hidden="true" />
      <div ref={noiseRef} className="cyber-noise" aria-hidden="true" />
    </>
  )
}
