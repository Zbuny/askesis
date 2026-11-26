// Построение кожи персонажа в фоне. Одна пересборка — около 100 мс, и пока
// мышцы «наливаются» при загрузке, их десяток подряд: в основном потоке
// это подвешивало бы прокрутку и вращение. Решётка (~15 МБ) создаётся один
// раз на воркер и переиспользуется.

import { createGrid, fillField, surfaceNets } from './sdfBody.js'

let grid = null

self.onmessage = ({ data }) => {
  const { id, gridSpec, prims, options } = data
  if (!grid) grid = createGrid(gridSpec)
  fillField(grid, prims, options)
  const mesh = surfaceNets(grid)
  self.postMessage({ id, ...mesh }, [mesh.positions.buffer, mesh.owners.buffer, mesh.indices.buffer])
}
