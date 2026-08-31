import { auth } from '../firebase.js'

// Базовый URL воркера без хвостов вроде /chat — иначе generateWorkoutPlan
// бьётся в несуществующий путь и получает 404 от Cloudflare, а не от Groq.
function normalizeWorkerUrl(url) {
  if (!url) return ''
  return url.trim().replace(/\/$/, '').replace(/\/(chat|coach|food)$/, '')
}

const WORKER_BASE = normalizeWorkerUrl(import.meta.env.VITE_AI_WORKER_URL)

export const aiConfigured = Boolean(WORKER_BASE)

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

async function workerFetch(path, payload) {
  if (!WORKER_BASE) {
    throw new Error('ИИ-помощник не настроен: пропишите VITE_AI_WORKER_URL в client/.env (см. worker/README.md)')
  }
  const user = auth.currentUser
  if (!user) throw new Error('Требуется авторизация')

  const token = await user.getIdToken()
  const url = path ? `${WORKER_BASE}${path}` : WORKER_BASE
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail ? ` (${data.detail})` : ''
    throw new Error(data.error ? `${data.error}${detail}` : `Ошибка ${response.status}`)
  }
  return data
}

export function generateWorkoutPlan({ profile, exercises }) {
  const candidates = pickCandidates(exercises, profile.equipment).map((ex) => ({
    id: ex.id,
    name: ex.nameRu || ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
  }))
  return workerFetch('', { profile, candidates })
}

export function planFromChat({ messages, exercises }) {
  const candidates = pickCandidates(exercises, null).map((ex) => ({
    id: ex.id,
    name: ex.nameRu || ex.name,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
  }))
  return workerFetch('', { conversation: messages, candidates })
}

export async function scanFood(imageDataUrl) {
  return workerFetch('/food', { image: imageDataUrl })
}

export async function askCoach({ kind, facts }) {
  const data = await workerFetch('/coach', { kind, facts })
  return data.reply
}

export async function askTrainer(messages, context) {
  const data = await workerFetch('/chat', { messages, context })
  return data.reply
}
