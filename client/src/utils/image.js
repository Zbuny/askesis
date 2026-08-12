// Фото с телефона может весить десятки МБ — пережимаем на клиенте перед
// отправкой в воркер, иначе распознавание будет медленным и дорогим по токенам.
const MAX_SIDE = 768
const JPEG_QUALITY = 0.7

// Обрезка по выделенной области. Доли, а не пиксели, потому что выделяют
// область на превью, а режем уже пережатую картинку — размеры у них разные.
//
// Зачем вообще: на снимке со стола вместе с тарелкой попадает половина кухни,
// и модель считает калории «на глаз» по всему кадру. Обрезать до тарелки —
// самый дешёвый способ поднять точность, и никакой ИИ его не заменит.
export function cropDataUrl(dataUrl, { x, y, width, height }) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
    img.onload = () => {
      const sx = Math.max(0, Math.round(x * img.width))
      const sy = Math.max(0, Math.round(y * img.height))
      const sw = Math.min(img.width - sx, Math.round(width * img.width))
      const sh = Math.min(img.height - sy, Math.round(height * img.height))

      // Слишком мелкий фрагмент модели уже ничего не скажет — оставляем как есть.
      if (sw < 32 || sh < 32) {
        resolve(dataUrl)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.src = dataUrl
  })
}

export function resizeImageToDataUrl(file, maxSide = MAX_SIDE, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width)
          width = maxSide
        } else if (height > maxSide) {
          width = Math.round((width * maxSide) / height)
          height = maxSide
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
