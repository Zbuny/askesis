// Фото с телефона может весить десятки МБ — пережимаем на клиенте перед
// отправкой в воркер, иначе распознавание будет медленным и дорогим по токенам.
const MAX_SIDE = 768
const JPEG_QUALITY = 0.7

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
