// Загрузка модели персонажа. Отдельным модулем, чтобы GLTFLoader попадал
// только в чанк сцены. Файл кэшируется по фигуре: смена одежды пересобирает
// персонажа из того же gltf без повторной загрузки.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const cache = new Map()
let loader = null

export function modelUrl(body) {
  return `${import.meta.env.BASE_URL}models/character_${body === 'f' ? 'f' : 'm'}.glb`
}

export function loadCharacterModel(body) {
  const url = modelUrl(body)
  if (!cache.has(url)) {
    loader = loader || new GLTFLoader()
    const promise = loader.loadAsync(url).catch((error) => {
      // Неудачную загрузку не кэшируем — следующая попытка пойдёт в сеть.
      cache.delete(url)
      throw error
    })
    cache.set(url, promise)
  }
  return cache.get(url)
}
