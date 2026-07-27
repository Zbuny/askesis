import { auth } from '../firebase.js'

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL

// Модель получает не всю библиотеку (873 упражнения не влезут в промпт),
// а подборку под выбранный инвентарь — иначе она начинает выдумывать id.
const MAX_CANDIDATES = 150

function pickCandidates(exercises, equipment) {
  const matching = equipment?.length
    ? exercises.filter((ex) => equipment.includes(ex.equipment))
    : exercises

  const byMuscle = new Map()
  matching.forEach((ex) => {
    const group = ex.muscleGroup || 'other'
    if (!byMuscle.has(group)) byMuscle.set(group, [])
    byMuscle.get(group).push(ex)
  })

  // Забираем по кругу из каждой группы мышц, чтобы подборка была сбалансированной.
  const groups = [...byMuscle.values()]
  const picked = []
  let index = 0
  while (picked.length < MAX_CANDIDATES && groups.some((group) => index < group.length)) {
    groups.forEach((group) => {
      if (picked.length < MAX_CANDIDATES && index < group.length) picked.push(group[index])
    })
    index += 1
  }
  return picked
}

async function requestPlan(payload, exercises, equipment) {
  if (!WORKER_URL) {
    throw new Error('ИИ-помощник не настроен: пропишите VITE_AI_WORKER_URL в client/.env (см. worker/README.md)')
  }
  const user = auth.currentUser
  if (!user) throw new Error('Требуется авторизация')

  const token = await user.getIdToken()
  const candidates = pickCandidates(exercises, equipment).map((ex) => ({
    id: ex.id,
    name: ex.nameRu || ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
  }))

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...payload, candidates }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`)
  return data
}

export function generateWorkoutPlan({ profile, exercises }) {
  return requestPlan({ profile }, exercises, profile.equipment)
}

// Собирает программу из уже состоявшегося диалога: инвентарь заранее
// неизвестен, поэтому подборку упражнений не сужаем.
export function planFromChat({ messages, exercises }) {
  return requestPlan({ conversation: messages }, exercises, null)
}

export async function askTrainer(messages) {
  if (!WORKER_URL) {
    throw new Error('ИИ-помощник не настроен: пропишите VITE_AI_WORKER_URL в client/.env (см. worker/README.md)')
  }
  const user = auth.currentUser
  if (!user) throw new Error('Требуется авторизация')

  const token = await user.getIdToken()
  const response = await fetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`)
  return data.reply
}
