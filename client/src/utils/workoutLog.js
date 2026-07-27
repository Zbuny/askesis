// Раньше на упражнение записывалась одна пара «вес × повторы», теперь —
// список подходов. Старые записи в Firestore остаются в прежнем формате,
// поэтому всё чтение лога идёт через эти помощники.

export function entrySets(entry) {
  if (!entry) return []
  if (Array.isArray(entry.sets)) return entry.sets
  if (entry.weight != null || entry.reps != null) {
    return [{ weight: Number(entry.weight) || 0, reps: Number(entry.reps) || 0 }]
  }
  return []
}

export function entryVolume(entry) {
  return entrySets(entry).reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0)
}

// Для графика прогресса берём самый тяжёлый подход в тренировке —
// он честнее отражает рост силы, чем среднее или первый подход.
export function entryTopWeight(entry) {
  const weights = entrySets(entry).map((set) => Number(set.weight) || 0)
  return weights.length ? Math.max(...weights) : 0
}

export function sessionVolume(session) {
  return (session?.entries || []).reduce((sum, entry) => sum + entryVolume(entry), 0)
}

export function formatEntry(entry) {
  const sets = entrySets(entry)
  if (sets.length === 0) return '—'
  // Подряд идущие одинаковые подходы схлопываем: «4×8 по 60 кг» читается
  // лучше, чем четыре одинаковые строки.
  const allSame = sets.every((s) => s.weight === sets[0].weight && s.reps === sets[0].reps)
  if (allSame && sets.length > 1) return `${sets.length}×${sets[0].reps} по ${sets[0].weight} кг`
  return sets.map((s) => `${s.weight}×${s.reps}`).join(', ')
}
