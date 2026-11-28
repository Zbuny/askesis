// Установка на экран «Домой». Chrome присылает beforeinstallprompt один раз
// и рано — часто до того, как отрисуется главная. Поэтому слушатель ставится
// при загрузке модуля (он импортируется из main.jsx), а событие ждёт, пока
// человек нажмёт «Установить».

let deferred = null
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => fn(Boolean(deferred)))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export function canPromptInstall() {
  return Boolean(deferred)
}

export function onInstallAvailability(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function promptInstall() {
  if (!deferred) return false
  const event = deferred
  deferred = null
  notify()
  event.prompt()
  const choice = await event.userChoice.catch(() => null)
  return choice?.outcome === 'accepted'
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
