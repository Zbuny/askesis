import { describe, it, expect } from 'vitest'
import { createGrid, fillField, surfaceNets } from './sdfBody.js'

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function sphereAt(cx, cy, cz, r, part = 'a', extra = {}) {
  const inv = [...IDENTITY]
  inv[12] = -cx
  inv[13] = -cy
  inv[14] = -cz
  return { kind: 'ellipsoid', inv, radii: [r, r, r], box: [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r], part, ...extra }
}

function build(prims, options) {
  const grid = createGrid({ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5], step: 0.02 })
  fillField(grid, prims, options)
  return surfaceNets(grid)
}

describe('surfaceNets', () => {
  it('сфера получается сферой', () => {
    const mesh = build([sphereAt(0, 0, 0, 0.3)])
    expect(mesh.positions.length).toBeGreaterThan(300)
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const r = Math.hypot(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2])
      expect(Math.abs(r - 0.3)).toBeLessThan(0.02)
    }
  })

  it('треугольники смотрят наружу', () => {
    const { positions: p, indices } = build([sphereAt(0, 0, 0, 0.3)])
    let outward = 0
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3]
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      if (nx * p[a] + ny * p[a + 1] + nz * p[a + 2] > 0) outward += 1
    }
    expect(outward / (indices.length / 3)).toBeGreaterThan(0.99)
  })

  it('хозяин вершины — ближайший примитив', () => {
    const mesh = build([sphereAt(-0.2, 0, 0, 0.12), sphereAt(0.2, 0, 0, 0.12)])
    for (let i = 0; i < mesh.owners.length; i += 1) {
      expect(mesh.owners[i]).toBe(mesh.positions[i * 3] < 0 ? 0 : 1)
    }
  })

  it('мышцы одной части сливаются, разные части — почти нет', () => {
    // Две сферы на расстоянии чуть больше суммы радиусов: внутри части
    // мягкий минимум перекидывает между ними перемычку, между частями — нет.
    const gap = (part2) => {
      const grid = createGrid({ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5], step: 0.01 })
      fillField(grid, [sphereAt(-0.13, 0, 0, 0.12, 'a'), sphereAt(0.13, 0, 0, 0.12, part2)], { partBlend: 0.08, crossBlend: 0.005 })
      const mid = Math.round(0.5 / 0.01)
      return grid.field[mid + grid.nx * (mid + grid.ny * mid)]
    }
    expect(gap('a')).toBeLessThan(0)
    expect(gap('b')).toBeGreaterThan(0)
  })
})
