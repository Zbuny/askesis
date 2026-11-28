// Черновики тренировок живут в localStorage — по тому же принципу, что таймер
// в useWorkoutTimer.js: React-стейт сбрасывается при размонтировании экрана
// (переход к упражнению, «как выполнять», сворачивание приложения), а
// localStorage переживает и возврат назад, и перезагрузку вкладки.

const PREFIX = 'askesis:draft:'

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

export function builderDraftKey(workoutId) {
  return workoutId ? `${PREFIX}builder:${workoutId}` : `${PREFIX}builder:new`
}

export function sessionDraftKey(workoutId) {
  return `${PREFIX}session:${workoutId}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function loadBuilderDraft(workoutId) {
  const raw = safeGet(builderDraftKey(workoutId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      savedAt: Number(parsed.savedAt) || 0,
    }
  } catch {
    return null
  }
}

export function saveBuilderDraft(workoutId, { title, items }) {
  safeSet(builderDraftKey(workoutId), JSON.stringify({ title, items, savedAt: Date.now() }))
}

export function clearBuilderDraft(workoutId) {
  safeRemove(builderDraftKey(workoutId))
}

export function loadSessionDraft(workoutId) {
  const raw = safeGet(sessionDraftKey(workoutId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.date !== todayKey()) return null
    return {
      results: parsed.results && typeof parsed.results === 'object' ? parsed.results : {},
      rir: parsed.rir && typeof parsed.rir === 'object' ? parsed.rir : {},
      followed: Array.isArray(parsed.followed) ? parsed.followed : [],
      savedAt: Number(parsed.savedAt) || 0,
    }
  } catch {
    return null
  }
}

export function saveSessionDraft(workoutId, { results, rir, followed }) {
  safeSet(
    sessionDraftKey(workoutId),
    JSON.stringify({
      date: todayKey(),
      results,
      rir,
      followed: Array.isArray(followed) ? followed : [...followed],
      savedAt: Date.now(),
    }),
  )
}

export function clearSessionDraft(workoutId) {
  safeRemove(sessionDraftKey(workoutId))
}

// Упражнения, отмеченные в нижней панели библиотеки, но ещё не добавленные.
// Карточка в панели ведёт на страницу упражнения — конструктор при этом
// размонтируется, и без этого черновика выбор пропал бы. Живёт в
// sessionStorage: это недоделанный жест, а не данные на завтра.
export function pickDraftKey(workoutId) {
  return `${PREFIX}picks:${workoutId || 'new'}`
}

export function loadPickDraft(workoutId) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(pickDraftKey(workoutId)) || 'null')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function savePickDraft(workoutId, ids) {
  try {
    if (ids.length) sessionStorage.setItem(pickDraftKey(workoutId), JSON.stringify(ids))
    else sessionStorage.removeItem(pickDraftKey(workoutId))
  } catch {}
}
