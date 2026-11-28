// Чистая часть перетаскивания списка — отдельно от DOM, чтобы её можно было
// проверить тестами.

// Переносит элемент с позиции from на позицию to (обе — в исходном списке).
export function moveItem(list, from, to) {
  if (from === to || from < 0 || from >= list.length) return list
  const target = Math.max(0, Math.min(list.length - 1, to))
  const copy = [...list]
  const [moved] = copy.splice(from, 1)
  copy.splice(target, 0, moved)
  return copy
}

// Куда встанет перетаскиваемый пункт: сколько ДРУГИХ пунктов окажутся выше
// точки y. middles — середины всех пунктов (включая перетаскиваемый, его
// пропускаем по индексу), снятые один раз в начале жеста: соседей мы только
// сдвигаем transform-ом, поэтому мерить их заново на каждом движении —
// значит мерить уже сдвинутые позиции и получать «дрожащую» цель.
export function dropIndex(middles, fromIndex, y) {
  let index = 0
  for (let i = 0; i < middles.length; i++) {
    if (i === fromIndex) continue
    if (y > middles[i]) index++
  }
  return index
}

// Скорость автопрокрутки у края экрана: 0 вне полосы edge, дальше растёт
// линейно до max, когда палец у самого края (или за ним).
export function edgeScrollSpeed(y, viewportHeight, edge = 72, max = 18) {
  if (y < edge) return -Math.round(max * Math.min(1, (edge - y) / edge))
  if (y > viewportHeight - edge) return Math.round(max * Math.min(1, (y - (viewportHeight - edge)) / edge))
  return 0
}
