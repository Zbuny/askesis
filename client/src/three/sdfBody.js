// Цельная кожа персонажа из набора примитивов.
//
// Каждая мышца — эллипсоид или капсула со своим масштабом роста. Если
// рисовать их отдельными мешами, получается манекен из шариков. Здесь они
// сливаются в одну поверхность: поле расстояний (SDF) каждого примитива
// объединяется «мягким минимумом», и там, где мышцы соприкасаются, появляется
// плавный переход, как под живой кожей. Из поля сетку извлекает алгоритм
// surface nets: на каждую ячейку решётки, через которую проходит
// поверхность, — одна вершина, на каждое пересечённое ребро — квадрат.
//
// Мягкость слияния задаётся двумя уровнями. Внутри одной части тела (рука,
// нога, корпус) — сильная, чтобы мышцы перетекали друг в друга. Между частями —
// слабая: иначе рука, висящая у корпуса, прилипла бы к нему. Детали рельефа
// (кубики пресса) задают свою, совсем маленькую мягкость, чтобы не
// размылись.
//
// Модуль не зависит от three.js: на входе — матрицы и размеры, на выходе —
// массивы вершин и треугольников. Так его можно гонять в тестах и при
// желании перенести в воркер.

const FAR = 1

// Полиномиальный мягкий минимум (Inigo Quilez). k — ширина перехода.
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Расстояние до примитива. inv — обратная матрица (column-major, 16 чисел)
// из пространства тела в локальное пространство примитива без масштаба.
function primDistance(prim, px, py, pz) {
  const e = prim.inv
  const x = e[0] * px + e[4] * py + e[8] * pz + e[12]
  const y = e[1] * px + e[5] * py + e[9] * pz + e[13]
  const z = e[2] * px + e[6] * py + e[10] * pz + e[14]

  if (prim.kind === 'capsule') {
    const cy = Math.max(-prim.h, Math.min(prim.h, y))
    const dy = y - cy
    return Math.sqrt(x * x + dy * dy + z * z) - prim.r
  }

  // Эллипсоид: приближение расстояния, точное у самой поверхности — а
  // больше нам и не нужно.
  const [rx, ry, rz] = prim.radii
  const ax = x / rx
  const ay = y / ry
  const az = z / rz
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az)
  const bx = x / (rx * rx)
  const by = y / (ry * ry)
  const bz = z / (rz * rz)
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz)
  if (k1 === 0) return -Math.min(rx, ry, rz)
  return (k0 * (k0 - 1)) / k1
}

export function createGrid({ min, max, step }) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1
  const ny = Math.ceil((max[1] - min[1]) / step) + 1
  const nz = Math.ceil((max[2] - min[2]) / step) + 1
  const size = nx * ny * nz
  return {
    min,
    step,
    nx,
    ny,
    nz,
    field: new Float32Array(size),
    owner: new Int16Array(size),
    partField: new Float32Array(size),
    partOwner: new Int16Array(size),
    cellVertex: new Int32Array(size),
  }
}

function boxToCells(grid, box) {
  const { min, step, nx, ny, nz } = grid
  const clamp = (v, n) => Math.max(0, Math.min(n - 1, v))
  return [
    clamp(Math.floor((box[0] - min[0]) / step), nx),
    clamp(Math.floor((box[1] - min[1]) / step), ny),
    clamp(Math.floor((box[2] - min[2]) / step), nz),
    clamp(Math.ceil((box[3] - min[0]) / step), nx),
    clamp(Math.ceil((box[4] - min[1]) / step), ny),
    clamp(Math.ceil((box[5] - min[2]) / step), nz),
  ]
}

// Заполняет поле расстояний. prims: [{ kind, inv, radii | r,h, box, blend,
// part }], box — [minX, minY, minZ, maxX, maxY, maxZ] в пространстве тела.
export function fillField(grid, prims, { partBlend = 0.03, crossBlend = 0.012 } = {}) {
  const { field, owner, partField, partOwner, min, step, nx, ny } = grid
  field.fill(FAR)
  owner.fill(-1)

  const parts = new Map()
  prims.forEach((prim, index) => {
    if (!parts.has(prim.part)) parts.set(prim.part, [])
    parts.get(prim.part).push(index)
  })

  parts.forEach((indices) => {
    // Общая рамка части тела, расширенная на ширину слияния.
    const pad = Math.max(partBlend, crossBlend) + step
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    indices.forEach((i) => {
      const b = prims[i].box
      for (let k = 0; k < 3; k += 1) {
        box[k] = Math.min(box[k], b[k] - pad)
        box[k + 3] = Math.max(box[k + 3], b[k + 3] + pad)
      }
    })
    const [x0, y0, z0, x1, y1, z1] = boxToCells(grid, box)

    for (let z = z0; z <= z1; z += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const row = nx * (y + ny * z)
        partField.fill(FAR, row + x0, row + x1 + 1)
        partOwner.fill(-1, row + x0, row + x1 + 1)
      }
    }

    indices.forEach((i) => {
      const prim = prims[i]
      const k = Math.min(partBlend, prim.blend ?? partBlend)
      const b = prim.box
      const [px0, py0, pz0, px1, py1, pz1] = boxToCells(grid, [
        b[0] - k - step, b[1] - k - step, b[2] - k - step,
        b[3] + k + step, b[4] + k + step, b[5] + k + step,
      ])
      for (let z = pz0; z <= pz1; z += 1) {
        const wz = min[2] + z * step
        for (let y = py0; y <= py1; y += 1) {
          const wy = min[1] + y * step
          const row = nx * (y + ny * z)
          for (let x = px0; x <= px1; x += 1) {
            const idx = row + x
            const d = primDistance(prim, min[0] + x * step, wy, wz)
            const a = partField[idx]
            if (d < a) partOwner[idx] = i
            partField[idx] = smin(a, d, k)
          }
        }
      }
    })

    for (let z = z0; z <= z1; z += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const row = nx * (y + ny * z)
        for (let x = x0; x <= x1; x += 1) {
          const idx = row + x
          const d = partField[idx]
          const a = field[idx]
          if (d < a) owner[idx] = partOwner[idx]
          field[idx] = smin(a, d, crossBlend)
        }
      }
    }
  })
}

// Рёбра куба: пары углов. Угол i — (i & 1, (i >> 1) & 1, (i >> 2) & 1).
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
]

export function surfaceNets(grid) {
  const { field, owner, cellVertex, min, step, nx, ny, nz } = grid
  cellVertex.fill(-1)
  const positions = []
  const owners = []
  const indices = []
  const corner = new Float32Array(8)
  const cornerIdx = new Int32Array(8)
  const offsets = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1]

  for (let z = 0; z < nz - 1; z += 1) {
    for (let y = 0; y < ny - 1; y += 1) {
      for (let x = 0; x < nx - 1; x += 1) {
        const base = x + nx * (y + ny * z)
        // Угол вне всех рамок (FAR) — значит, и вся ячейка снаружи: рамки
        // расширены минимум на шаг решётки. Таких ячеек большинство.
        if (field[base] >= FAR) continue
        let mask = 0
        for (let c = 0; c < 8; c += 1) {
          const idx = base + offsets[c]
          cornerIdx[c] = idx
          corner[c] = field[idx]
          if (corner[c] < 0) mask |= 1 << c
        }
        if (mask === 0 || mask === 255) continue

        let sx = 0
        let sy = 0
        let sz = 0
        let count = 0
        for (let e = 0; e < 12; e += 1) {
          const [a, b] = EDGES[e]
          const va = corner[a]
          const vb = corner[b]
          if (va < 0 === vb < 0) continue
          const t = va / (va - vb)
          sx += (a & 1) + ((b & 1) - (a & 1)) * t
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t
          count += 1
        }

        // Хозяин вершины — примитив самого «глубокого» угла ячейки.
        let best = 0
        for (let c = 1; c < 8; c += 1) if (corner[c] < corner[best]) best = c

        cellVertex[base] = positions.length / 3
        positions.push(
          min[0] + (x + sx / count) * step,
          min[1] + (y + sy / count) * step,
          min[2] + (z + sz / count) * step,
        )
        owners.push(owner[cornerIdx[best]])
      }
    }
  }

  // Квады: каждое ребро решётки со сменой знака делят четыре ячейки.
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    if (flip) indices.push(a, c, b, a, d, c)
    else indices.push(a, b, c, a, c, d)
  }
  const dx = 1
  const dy = nx
  const dz = nx * ny
  for (let z = 1; z < nz - 1; z += 1) {
    for (let y = 1; y < ny - 1; y += 1) {
      for (let x = 1; x < nx - 1; x += 1) {
        const i = x + nx * (y + ny * z)
        const inside = field[i] < 0
        if (inside !== field[i + dx] < 0) {
          quad(cellVertex[i], cellVertex[i - dy], cellVertex[i - dy - dz], cellVertex[i - dz], !inside)
        }
        if (inside !== field[i + dy] < 0) {
          quad(cellVertex[i], cellVertex[i - dz], cellVertex[i - dz - dx], cellVertex[i - dx], !inside)
        }
        if (inside !== field[i + dz] < 0) {
          quad(cellVertex[i], cellVertex[i - dx], cellVertex[i - dx - dy], cellVertex[i - dy], !inside)
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    owners: Int16Array.from(owners),
    indices: positions.length / 3 > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices),
  }
}
