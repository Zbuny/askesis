const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

const MAX_CANDIDATES = 150
const MAX_WORKOUTS = 6

let jwksCache = null
let jwksFetchedAt = 0

async function getJwks() {
  if (jwksCache && Date.now() - jwksFetchedAt < 3_600_000) return jwksCache
  const res = await fetch(JWKS_URL)
  if (!res.ok) throw new Error('jwks unavailable')
  jwksCache = await res.json()
  jwksFetchedAt = Date.now()
  return jwksCache
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)))
}

async function verifyIdToken(token, projectId) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('malformed token')

  const header = decodeSegment(parts[0])
  const payload = decodeSegment(parts[1])

  const jwks = await getJwks()
  const jwk = jwks.keys.find((key) => key.kid === header.kid)
  if (!jwk) throw new Error('unknown signing key')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!verified) throw new Error('bad signature')

  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId) throw new Error('bad audience')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad issuer')
  if (payload.exp <= now) throw new Error('token expired')
  if (!payload.sub) throw new Error('no subject')

  return payload
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    workouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exerciseId: { type: 'string' },
                targetSets: { type: 'integer' },
                targetReps: { type: 'integer' },
              },
              required: ['exerciseId', 'targetSets', 'targetReps'],
            },
          },
        },
        required: ['title', 'items'],
      },
    },
  },
  required: ['summary', 'workouts'],
}

// Groq принимает только флаг json_object, без схемы — поэтому форму ответа
// задаём текстом, а RESPONSE_SCHEMA остаётся единственным её описанием.
const SYSTEM_PROMPT = `Ты — опытный тренер по силовой подготовке. Отвечай ТОЛЬКО валидным JSON без markdown-обёрток и пояснений.

JSON должен строго соответствовать этой схеме:
${JSON.stringify(RESPONSE_SCHEMA)}

Пример формы ответа:
{"summary":"текст","workouts":[{"title":"День 1 — Верх тела","items":[{"exerciseId":"Barbell_Squat","targetSets":4,"targetReps":8}]}]}`

function buildPrompt(profile, candidates) {
  const catalogue = candidates
    .map((ex) => `${ex.id} | ${ex.name} | ${ex.muscleGroup || '-'} | ${ex.equipment || '-'}`)
    .join('\n')

  return `Ты — опытный тренер по силовой подготовке. Составь персональную программу тренировок.

Данные о человеке:
- Цель: ${profile.goal || 'не указана'}
- Уровень подготовки: ${profile.level || 'не указан'}
- Тренировок в неделю: ${profile.daysPerWeek || 3}
- Доступный инвентарь: ${(profile.equipment || []).join(', ') || 'не указан'}
- Ограничения и травмы: ${profile.limits || 'нет'}
- Возраст: ${profile.age || 'не указан'}, вес: ${profile.weight || 'не указан'} кг, рост: ${profile.height || 'не указан'} см

Доступные упражнения (формат: id | название | группа мышц | инвентарь):
${catalogue}

Требования к ответу:
- Составь ровно ${profile.daysPerWeek || 3} тренировок (не больше ${MAX_WORKOUTS}).
- Используй ТОЛЬКО id из списка выше. Не придумывай новые id.
- В каждой тренировке 4-7 упражнений, сбалансированных по группам мышц.
- targetSets и targetReps подбирай под цель и уровень.
- Названия тренировок — на русском, коротко и по делу (например «День 1 — Верх тела»).
- В summary на русском объясни логику программы в 2-3 предложениях.`
}

function sanitizeCandidates(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((ex) => ex && typeof ex.id === 'string' && typeof ex.name === 'string')
    .slice(0, MAX_CANDIDATES)
    .map((ex) => ({
      id: ex.id,
      name: String(ex.name).slice(0, 120),
      muscleGroup: ex.muscleGroup ? String(ex.muscleGroup).slice(0, 60) : '',
      equipment: ex.equipment ? String(ex.equipment).slice(0, 60) : '',
    }))
}

function sanitizeProfile(raw) {
  const profile = raw && typeof raw === 'object' ? raw : {}
  const text = (value, max) => (value == null ? '' : String(value).slice(0, max))
  return {
    goal: text(profile.goal, 200),
    level: text(profile.level, 60),
    daysPerWeek: Math.min(Math.max(Number(profile.daysPerWeek) || 3, 1), MAX_WORKOUTS),
    equipment: Array.isArray(profile.equipment)
      ? profile.equipment.slice(0, 20).map((item) => text(item, 60))
      : [],
    limits: text(profile.limits, 400),
    age: text(profile.age, 10),
    weight: text(profile.weight, 10),
    height: text(profile.height, 10),
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
    if (!allowed.includes(origin)) {
      return new Response('Forbidden origin', { status: 403 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== 'POST') {
      return json({ error: 'Метод не поддерживается' }, 405, origin)
    }

    const authorization = request.headers.get('Authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return json({ error: 'Требуется авторизация' }, 401, origin)

    try {
      await verifyIdToken(token, env.FIREBASE_PROJECT_ID)
    } catch {
      return json({ error: 'Недействительный токен' }, 401, origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Некорректный JSON' }, 400, origin)
    }

    const candidates = sanitizeCandidates(body.candidates)
    if (candidates.length === 0) {
      return json({ error: 'Не передан список упражнений' }, 400, origin)
    }
    const profile = sanitizeProfile(body.profile)

    const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        // json_object — режим, который Groq поддерживает на всех моделях;
        // структуру описываем в промпте, а мусорные id всё равно отсеиваем ниже.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(profile, candidates) },
        ],
      }),
    })

    if (!groqResponse.ok) {
      // Текст ошибки нужен, чтобы отличить исчерпанную квоту от неверного
      // ключа или снятой с обслуживания модели — иначе виден только код.
      const detail = await groqResponse.text().catch(() => '')
      console.log('groq error', groqResponse.status, detail.slice(0, 500))
      const message = detail.slice(0, 400) || groqResponse.status
      return json({ error: `Groq вернул ошибку ${groqResponse.status}: ${message}` }, 502, origin)
    }

    const data = await groqResponse.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) return json({ error: 'Пустой ответ модели' }, 502, origin)

    let plan
    try {
      plan = JSON.parse(text)
    } catch {
      return json({ error: 'Модель вернула некорректный JSON' }, 502, origin)
    }

    // Модель иногда выдумывает id — оставляем только те, что реально есть в библиотеке.
    const validIds = new Set(candidates.map((ex) => ex.id))
    const workouts = (plan.workouts || [])
      .slice(0, MAX_WORKOUTS)
      .map((workout) => ({
        title: String(workout.title || 'Тренировка').slice(0, 120),
        items: (workout.items || [])
          .filter((item) => validIds.has(item.exerciseId))
          .map((item) => ({
            exerciseId: item.exerciseId,
            targetSets: Math.min(Math.max(Number(item.targetSets) || 3, 1), 10),
            targetReps: Math.min(Math.max(Number(item.targetReps) || 10, 1), 100),
          })),
      }))
      .filter((workout) => workout.items.length > 0)

    if (workouts.length === 0) {
      return json({ error: 'Модель не смогла собрать программу — попробуйте ещё раз' }, 502, origin)
    }

    return json({ summary: String(plan.summary || '').slice(0, 1000), workouts }, 200, origin)
  },
}
