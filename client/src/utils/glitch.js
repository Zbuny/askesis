// Чистые помощники глитча темы «Киберпанк»: без DOM, чтобы их можно было
// проверить тестами. Сам эффект живёт в components/CyberGlitch.jsx.

// «Перебор символов»: цифры, до которых ещё не дошла волна, подменяются
// случайными, всё остальное (пробелы, слэши, буквы «XP») стоит на месте.
// Длина строки не меняется, а шрифт цифр моноширинный, поэтому текст не
// прыгает по ширине. progress от 0 до 1: при 1 строка уже настоящая.
export function scrambleDigits(text, progress, random = Math.random) {
  if (progress >= 1) return text
  const digits = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] >= '0' && text[i] <= '9') digits.push(i)
  }
  if (digits.length === 0) return text
  // Слева направо: первые цифры «встают» раньше, как у табло.
  const settled = Math.floor(digits.length * Math.max(0, progress))
  const chars = text.split('')
  digits.forEach((index, order) => {
    if (order >= settled) chars[index] = String(Math.floor(random() * 10))
  })
  return chars.join('')
}

export function hasDigits(text) {
  return /\d/.test(text || '')
}

// Случайная пауза между вспышками: ровный ритм глаз быстро замечает и
// начинает ждать, а случайный читается как «живой» сбой.
export function nextDelay(min, max, random = Math.random) {
  return Math.round(min + (max - min) * random())
}
