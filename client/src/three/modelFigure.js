// Персонаж из модели (character_m.glb / character_f.glb).
//
// Модель собирает scripts/blender/build_character.py из набора Blender
// «Human Base Meshes» (CC0). В ней:
// - тело с 12 морфами — по группе мышц из utils/physique.js; значение 1 —
//   предельно развитая группа, отрицательное — нетренированная;
// - атрибут _region у вершин: какой группе мышц принадлежит вершина;
// - одежда — объекты `<слот>_<вещь>` (top_tee, hair_short…), вырезанные из
//   того же тела, с теми же морфами: растут вместе с мышцами;
// - материалы skin/cloth/hair перекрашиваются по образу, остальные (gold,
//   sole, eye, ribbon) — как есть.
//
// Интерфейс тот же, что у процедурной фигуры (figure.js):
//   { root, update({ growth, pump, highlight, time }), dispose, pickables }

import * as THREE from 'three'
import { REGIONS } from '../utils/physique.js'
import { SLOTS } from '../utils/wardrobe.js'

const REGION_KEYS = REGIONS.map((region) => region.key)

// Рост 0 — не «средний человек из модели», а нетренированное тело: мышцы
// чуть меньше исходных. Так первые месяцы тренировок видны сразу.
export const UNTRAINED = -0.45
const PUMP_BOOST = 0.08

export function influenceFor(growth = 0, pump = 0) {
  const g = Math.max(0, Math.min(1, growth))
  return UNTRAINED + (1 - UNTRAINED) * g + PUMP_BOOST * Math.max(0, Math.min(1, pump))
}

// Кепка и шапка закрывают макушку: под ними вместо причёски видны только
// виски и затылок (hairunder). То, что свисает ниже убора — хвост и длинные
// пряди (hairtail_<причёска>), — видно и в головном уборе.
const COVERING_HATS = new Set(['cap', 'beanie'])

export function isItemVisible(name, look) {
  const covered = COVERING_HATS.has(look.head)
  if (name === 'hairunder') return covered && look.hair !== 'none'
  if (name.startsWith('hairtail_')) return look.hair === name.slice('hairtail_'.length)
  const slot = SLOTS.find((s) => name.startsWith(`${s.key}_`))
  if (!slot) return true
  const id = name.slice(slot.key.length + 1)
  if (look[slot.key] !== id) return false
  if (slot.key === 'hair' && covered) return false
  return true
}

function slotOf(name) {
  if (name === 'hairunder' || name.startsWith('hairtail_')) return SLOTS.find((s) => s.key === 'hair')
  return SLOTS.find((s) => name.startsWith(`${s.key}_`)) || null
}

const HAIR_IDS = SLOTS.find((slot) => slot.key === 'hair').items.map((item) => item.id)
const ITEM_NAMES = new Set([
  ...SLOTS.flatMap((slot) => slot.items.map((item) => `${slot.key}_${item.id}`)),
  ...HAIR_IDS.map((id) => `hairtail_${id}`),
  'hairunder',
])

// Узел вещи. Вещь с двумя материалами (кроссовок с подошвой, хвост с
// резинкой) GLTFLoader раскладывает на группу с дочерними мешами, и имя
// меша тогда — имя сетки из Blender («shoes_sneakers_L»), а не вещи.
// Поэтому ищем вверх по дереву точное имя вещи.
function itemNode(object) {
  let node = object
  while (node) {
    if (ITEM_NAMES.has(node.name)) return node
    node = node.parent
  }
  return null
}

function colorFor(materialName, slot, look) {
  if (materialName === 'skin') return look.skinHex
  if (materialName === 'hair') return look.hairHex
  if (materialName === 'cloth') {
    if (!slot) return null
    // Резинка хвоста — цвета головного убора, иначе её не видно на волосах.
    if (slot.key === 'hair') return look.headHex
    return look[`${slot.key}Hex`]
  }
  return null
}

// Нормали морфов в файл не пишутся (это больше половины его веса) —
// считаем их один раз на геометрию: нормали формы «база + морф» минус
// нормали базы. Без них свет не замечал бы выросших мышц.
const prepared = new WeakSet()
export function prepareMorphNormals(geometry) {
  if (prepared.has(geometry)) return
  prepared.add(geometry)
  const morphs = geometry.morphAttributes.position
  if (!morphs?.length || geometry.morphAttributes.normal?.length) return
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const base = geometry.attributes.position
  const baseNormal = geometry.attributes.normal
  const relative = geometry.morphTargetsRelative
  const scratch = new THREE.BufferGeometry()
  scratch.setIndex(geometry.index)

  // Разность берём между пересчитанными нормалями обеих форм, а не с
  // нормалями из файла: у оболочек одежды обход граней может быть обратным,
  // и тогда «пересчитанная минус файловая» разворачивала бы нормаль там, где
  // морф активен (тёмные пятна на ткани). Знак выравниваем по файлу.
  function computed(positions) {
    scratch.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    scratch.deleteAttribute('normal')
    scratch.computeVertexNormals()
    return scratch.attributes.normal
  }
  const basePositions = new Float32Array(base.count * 3)
  for (let i = 0; i < base.count; i++) {
    basePositions[i * 3] = base.getX(i)
    basePositions[i * 3 + 1] = base.getY(i)
    basePositions[i * 3 + 2] = base.getZ(i)
  }
  const baseComputed = computed(basePositions).clone()
  let agreement = 0
  for (let i = 0; i < base.count; i++) {
    agreement +=
      baseComputed.getX(i) * baseNormal.getX(i) +
      baseComputed.getY(i) * baseNormal.getY(i) +
      baseComputed.getZ(i) * baseNormal.getZ(i)
  }
  const sign = agreement < 0 ? -1 : 1

  const normals = morphs.map((morph) => {
    const shaped = new Float32Array(base.count * 3)
    for (let i = 0; i < base.count; i++) {
      shaped[i * 3] = morph.getX(i) + (relative ? base.getX(i) : 0)
      shaped[i * 3 + 1] = morph.getY(i) + (relative ? base.getY(i) : 0)
      shaped[i * 3 + 2] = morph.getZ(i) + (relative ? base.getZ(i) : 0)
    }
    const n = computed(shaped)
    const delta = new Float32Array(base.count * 3)
    for (let i = 0; i < base.count; i++) {
      delta[i * 3] = sign * (n.getX(i) - baseComputed.getX(i))
      delta[i * 3 + 1] = sign * (n.getY(i) - baseComputed.getY(i))
      delta[i * 3 + 2] = sign * (n.getZ(i) - baseComputed.getZ(i))
    }
    return new THREE.BufferAttribute(delta, 3)
  })
  scratch.dispose()
  geometry.morphAttributes.normal = normals
  // three.js кэширует текстуру морфов по числу атрибутов — пересоздать.
  geometry.dispose()
}

// Подсветка группы мышц — цветом вершин: множитель 1 — как есть, больше —
// теплее и ярче. Номер группы у вершины целый, и цвет между вершинами
// интерполируется плавно (номер группы так интерполировать нельзя).
const GLOW_TARGET = [1.55, 1.3, 0.85]

// Своя геометрия на персонажа: все атрибуты и морфы — общие с загруженной
// моделью, свой только буфер цвета для подсветки.
function withOwnColors(geometry) {
  const own = new THREE.BufferGeometry()
  Object.entries(geometry.attributes).forEach(([name, attribute]) => own.setAttribute(name, attribute))
  own.setIndex(geometry.index)
  own.morphAttributes = geometry.morphAttributes
  own.morphTargetsRelative = geometry.morphTargetsRelative
  geometry.groups.forEach((group) => own.addGroup(group.start, group.count, group.materialIndex))
  const count = geometry.attributes.position.count
  own.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  return own
}

export function createModelFigure(gltf, look) {
  const root = new THREE.Group()
  const model = gltf.scene.clone(true)
  root.add(model)

  const glow = new Array(REGION_KEYS.length).fill(0)
  const glowing = []
  const ownGeometries = []
  const materials = []
  const morphing = []
  const pickables = []

  model.traverse((object) => {
    if (!object.isMesh) return
    const owner = itemNode(object)
    const slot = owner ? slotOf(owner.name) : null
    if (owner && !isItemVisible(owner.name, look)) {
      object.visible = false
      return
    }

    if (object.geometry.morphAttributes.position?.length) {
      prepareMorphNormals(object.geometry)
      morphing.push(object)
    }
    if (object.geometry.attributes._region) {
      object.geometry = withOwnColors(object.geometry)
      ownGeometries.push(object.geometry)
      const regions = object.geometry.attributes._region
      const index = new Int8Array(regions.count)
      for (let i = 0; i < regions.count; i++) index[i] = Math.round(regions.getX(i))
      glowing.push({ colors: object.geometry.attributes.color, index })
    }
    const geometry = object.geometry
    const list = Array.isArray(object.material) ? object.material : [object.material]
    const own = list.map((source) => {
      const material = source.clone()
      const hex = colorFor(source.name, slot, look)
      if (hex) material.color.set(hex)
      if (source.name === 'cloth' || source.name === 'hair') {
        // Оболочка одежды — в паре миллиметров от кожи: сдвиг по глубине
        // не даёт коже проступать пятнами на расстоянии.
        material.polygonOffset = true
        material.polygonOffsetFactor = -1
        material.polygonOffsetUnits = -2
        material.side = THREE.DoubleSide
      }
      if (geometry.attributes._region) material.vertexColors = true
      materials.push(material)
      return material
    })
    object.material = Array.isArray(object.material) ? own : own[0]
    // Выросшие мышцы выходят за исходную рамку — не отсекать на краю кадра.
    object.frustumCulled = false

    if (geometry.attributes._region) {
      const regions = geometry.attributes._region
      object.userData.regionOf = (hit) => {
        if (!hit.face) return null
        const index = Math.round(regions.getX(hit.face.a))
        return REGION_KEYS[index] || null
      }
      pickables.push(object)
    }
  })

  const influences = {}
  let lastKey = ''

  function update({ growth = {}, pump = {}, highlight = null, time = 0 } = {}) {
    REGION_KEYS.forEach((key) => {
      influences[key] = influenceFor(growth[key] || 0, pump[key] || 0)
    })
    const key = REGION_KEYS.map((k) => influences[k].toFixed(3)).join(',')
    if (key !== lastKey) {
      lastKey = key
      morphing.forEach((mesh) => {
        const dictionary = mesh.morphTargetDictionary
        Object.entries(dictionary).forEach(([name, index]) => {
          if (name in influences) mesh.morphTargetInfluences[index] = influences[name]
        })
      })
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 4)
    let changed = false
    REGION_KEYS.forEach((region, i) => {
      const lit = highlight === region ? 0.45 + 0.35 * pulse : 0
      const value = Math.round(Math.min(1, (pump[region] || 0) * 0.3 + lit) * 50) / 50
      if (value !== glow[i]) {
        glow[i] = value
        changed = true
      }
    })
    if (changed) {
      glowing.forEach(({ colors, index }) => {
        const array = colors.array
        for (let v = 0; v < index.length; v++) {
          const t = index[v] >= 0 ? glow[index[v]] : 0
          array[v * 3] = 1 + (GLOW_TARGET[0] - 1) * t
          array[v * 3 + 1] = 1 + (GLOW_TARGET[1] - 1) * t
          array[v * 3 + 2] = 1 + (GLOW_TARGET[2] - 1) * t
        }
        colors.needsUpdate = true
      })
    }
    return false
  }

  function dispose() {
    // Геометрия общая с загруженным файлом (его кэширует modelLoader) —
    // освобождаем только свои материалы.
    materials.forEach((material) => material.dispose())
    // Свои у персонажа только обёртки геометрии с буфером цвета. Общие
    // атрибуты three.js при следующем показе модели загрузит в видеопамять заново.
    ownGeometries.forEach((geometry) => geometry.dispose())
  }

  update({})
  return { root, update, dispose, pickables }
}
