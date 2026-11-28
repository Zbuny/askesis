// Фигура персонажа: цельная кожа поверх «анатомического» каркаса.
//
// Каркас — невидимые узлы: каждая мышца это эллипсоид или капсула со своим
// размером, прибавкой при росте и сдвигом наружу. Из каркаса sdfBody.js
// строит одну гладкую поверхность, где мышцы плавно перетекают друг в друга.
// Рост — это просто новые размеры узлов и пересборка кожи. Внешней модели и
// морф-таргетов не нужно: персонаж приезжает вместе с кодом.
//
// Одежда облегающая, как компрессионная: она красит вершины кожи по зонам
// тела, поэтому сидит на любой фигуре и рост виден и в футболке. Объёмные
// вещи (кепка, волосы, пояс, подошвы) — отдельные меши поверх.
//
// Модуль ничего не знает о React и о журнале: на вход — внешний вид
// (avatarLook) и числа роста 0..1 по группам, на выходе — THREE.Group.

import * as THREE from 'three'
import { createGrid, fillField, surfaceNets } from './sdfBody.js'

const GOLD = new THREE.Color('#d8bb84')

// Решётка поля в пространстве фигуры (до масштаба PROPS.scale). Шаг 8.5 мм —
// компромисс: кубики пресса ещё читаются, а пересборка укладывается в
// десятки миллисекунд.
const GRID = { min: [-0.46, -0.03, -0.25], max: [0.46, 1.8, 0.25], step: 0.0085 }
// Мягкость слияния внутри части тела и между частями (см. sdfBody.js).
const PART_BLEND = 0.03
const CROSS_BLEND = 0.016
// Пересобирать кожу, только когда рост заметно изменился, и не чаще, чем
// раз в столько миллисекунд — пока мышцы «наливаются» при загрузке.
const REBUILD_EPSILON = 0.012
const REBUILD_INTERVAL_MS = 90

const PROPS = {
  m: {
    scale: 1,
    shoulderX: 0.215,
    shoulderY: 1.41,
    hipX: 0.088,
    chestW: 0.172,
    waistW: 0.132,
    pelvisW: 0.152,
    headR: 0.112,
    armR: 0.037,
    thighR: 0.06,
    gain: 1,
  },
  f: {
    scale: 0.955,
    shoulderX: 0.188,
    shoulderY: 1.395,
    hipX: 0.094,
    chestW: 0.15,
    waistW: 0.112,
    pelvisW: 0.168,
    headR: 0.106,
    armR: 0.031,
    thighR: 0.062,
    // Та же история тренировок даёт женской фигуре меньше объёма — как и
    // в жизни. Прогресс в процентах при этом одинаковый.
    gain: 0.68,
  },
}

// Что закрывает каждая вещь: список зон тела, которые она перекрашивает.
const TOP_ZONES = {
  none: [],
  bra: ['torso'],
  tank: ['torso', 'belly'],
  tee: ['torso', 'belly', 'upperArm'],
  longsleeve: ['torso', 'belly', 'upperArm', 'forearm'],
  hoodie: ['torso', 'belly', 'upperArm', 'forearm'],
}

const BOTTOM_ZONES = {
  shorts: ['pelvis', 'thigh'],
  joggers: ['pelvis', 'thigh', 'shin'],
  tights: ['pelvis', 'thigh', 'shin'],
  wide: ['pelvis', 'thigh', 'shin'],
}

function makeMaterial(hex, { roughness = 0.62, metalness = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness })
}

export function createFigure(look) {
  const P = PROPS[look.body] || PROPS.m
  const root = new THREE.Group()
  root.scale.setScalar(P.scale)
  root.userData.part = 'torso'

  const geometries = []
  const materials = []
  const muscles = []
  const pickables = []
  const arms = []
  const prims = []

  function geo(g) {
    geometries.push(g)
    return g
  }
  function mat(m) {
    materials.push(m)
    return m
  }

  const sphere = geo(new THREE.SphereGeometry(1, 36, 24))
  const skin = mat(makeMaterial(look.skinHex, { roughness: 0.55 }))
  const top = mat(makeMaterial(look.topHex, { roughness: 0.82 }))
  const bottom = mat(makeMaterial(look.bottomHex, { roughness: 0.85 }))
  const shoes = mat(makeMaterial(look.shoesHex, { roughness: 0.7 }))
  const sole = mat(makeMaterial('#ecebe6', { roughness: 0.9 }))
  const hair = mat(makeMaterial(look.hairHex, { roughness: 0.9 }))
  const headwear = mat(makeMaterial(look.headHex, { roughness: 0.8 }))
  const extra = mat(makeMaterial(look.extraHex, { roughness: 0.7 }))
  const gold = mat(makeMaterial('#c9a464', { roughness: 0.32, metalness: 0.85 }))
  const leaf = mat(makeMaterial('#b8913f', { roughness: 0.4, metalness: 0.7 }))

  const topZones = TOP_ZONES[look.top] || []
  const bottomZones = BOTTOM_ZONES[look.bottom] || []

  function zoneMaterial(zone) {
    if (topZones.includes(zone)) return top
    if (bottomZones.includes(zone)) return bottom
    if (zone === 'foot' && look.shoes !== 'none') return shoes
    if (zone === 'hand' && look.extra === 'gloves') return extra
    return skin
  }

  // Меш поверх кожи (волосы, головные уборы, капюшон).
  function ellipsoid(parent, { pos = [0, 0, 0], size, rot = [0, 0, 0], material }) {
    const mesh = new THREE.Mesh(sphere, material)
    mesh.position.set(...pos)
    mesh.scale.set(...size)
    mesh.rotation.set(...rot)
    parent.add(mesh)
    return mesh
  }

  // ---------- каркас ----------

  function partOf(parent) {
    let node = parent
    while (node && !node.userData.part) node = node.parent
    return node?.userData.part || 'torso'
  }

  function primitive(parent, { pos, size = [1, 1, 1], rot = [0, 0, 0], capsule, zone, region = null, blend }) {
    const node = new THREE.Object3D()
    node.position.set(...pos)
    node.scale.set(...size)
    node.rotation.set(...rot)
    parent.add(node)
    const prim = { node, kind: capsule ? 'capsule' : 'ellipsoid', zone, region, blend, part: partOf(parent) }
    if (capsule) {
      prim.baseR = capsule[0]
      prim.baseH = capsule[1] / 2
    }
    prims.push(prim)
    return node
  }

  // Мышца: базовый размер, прибавка масштаба при росте 1 и сдвиг наружу,
  // чтобы она выпирала, а не утопала в теле. blend — своя мягкость слияния
  // для мелкого рельефа.
  function muscle(parent, region, zone, { pos, size = [1, 1, 1], rot = [0, 0, 0], gain, push = [0, 0, 0], capsule, blend }) {
    const node = primitive(parent, { pos, size, rot, capsule, zone, region, blend })
    muscles.push({
      node,
      region,
      basePos: new THREE.Vector3(...pos),
      baseScale: new THREE.Vector3(...size),
      gain: new THREE.Vector3(...gain),
      push: new THREE.Vector3(...push),
    })
    return node
  }

  function bodyPart(parent, zone, { pos, size, rot }) {
    return primitive(parent, { pos, size, rot, zone })
  }

  // ---------- корпус ----------

  const headY = 1.63
  const r = P.headR
  const headPart = new THREE.Group()
  headPart.userData.part = 'head'
  root.add(headPart)

  muscle(root, 'back', 'torso', {
    pos: [0, 1.3, 0],
    size: [P.chestW, 0.2, 0.105],
    gain: [0.14, 0.02, 0.1],
  })

  muscle(root, 'abs', 'belly', {
    pos: [0, 1.085, 0],
    size: [P.waistW, 0.15, 0.09],
    gain: [0.04, 0, 0.05],
  })

  muscle(root, 'glutes', 'pelvis', {
    pos: [0, 0.93, 0],
    size: [P.pelvisW, 0.11, 0.1],
    gain: [0.05, 0, 0.05],
  })

  muscle(root, 'traps', 'neck', {
    pos: [0, 1.5, -0.005],
    capsule: [0.05, 0.1],
    gain: [0.35, 0, 0.35],
  })

  // Голова — без лица: стилизованный манекен не пугает «зловещей долиной»
  // и одинаково читается в любой одежде.
  bodyPart(headPart, 'head', { pos: [0, headY, 0], size: [r * 0.92, r * 1.12, r] })
  bodyPart(headPart, 'head', { pos: [0, headY - r * 0.62, r * 0.18], size: [r * 0.7, r * 0.5, r * 0.72] })

  // Грудные. У женской фигуры — мягче и ниже, с меньшей прибавкой.
  ;[1, -1].forEach((s) => {
    const female = look.body === 'f'
    muscle(root, 'chest', 'torso', {
      pos: [s * 0.078, female ? 1.33 : 1.345, female ? 0.07 : 0.072],
      size: female ? [0.074, 0.07, 0.052] : [0.088, 0.066, 0.04],
      rot: [0, 0, -s * 0.15],
      gain: female ? [0.15, 0.12, 0.45] : [0.22, 0.2, 0.85],
      push: [s * 0.006, -0.004, female ? 0.01 : 0.022],
      blend: 0.016,
    })
  })

  // Пресс: шесть «кубиков», которые при нуле почти утоплены в живот и
  // проступают по мере роста. Мягкость слияния у них почти нулевая —
  // иначе рельеф расплылся бы в гладкий живот.
  ;[1.205, 1.13, 1.055].forEach((y) => {
    ;[1, -1].forEach((s) => {
      muscle(root, 'abs', 'belly', {
        pos: [s * 0.034, y, 0.074],
        size: [0.03, 0.032, 0.01],
        gain: [0.1, 0.05, 1.2],
        push: [0, 0, 0.01],
        blend: 0.006,
      })
    })
  })

  // Спина: широчайшие дают V-силуэт, верх спины — толщину, разгибатели —
  // рельеф поясницы.
  ;[1, -1].forEach((s) => {
    muscle(root, 'back', 'torso', {
      pos: [s * 0.122, 1.25, -0.035],
      size: [0.07, 0.14, 0.064],
      rot: [0, 0, s * 0.18],
      gain: [0.75, 0.1, 0.35],
      push: [s * 0.03, 0, -0.008],
    })
    muscle(root, 'back', 'belly', {
      pos: [s * 0.034, 1.1, -0.066],
      size: [0.028, 0.1, 0.024],
      gain: [0.4, 0.05, 0.8],
      push: [0, 0, -0.01],
      blend: 0.012,
    })
    muscle(root, 'traps', 'torso', {
      pos: [s * 0.075, 1.458, -0.022],
      size: [0.085, 0.034, 0.05],
      rot: [0, 0, -s * 0.42],
      gain: [0.2, 1.0, 0.5],
      push: [0, 0.012, 0],
    })
    muscle(root, 'glutes', 'pelvis', {
      pos: [s * 0.066, 0.92, -0.058],
      size: [0.07, 0.074, 0.05],
      gain: [0.3, 0.22, 0.75],
      push: [s * 0.004, 0, -0.018],
    })
  })
  muscle(root, 'back', 'torso', {
    pos: [0, 1.31, -0.062],
    size: [0.12, 0.11, 0.045],
    gain: [0.25, 0.1, 0.8],
    push: [0, 0, -0.015],
  })

  // ---------- руки ----------

  ;[1, -1].forEach((s) => {
    const arm = new THREE.Group()
    arm.position.set(s * P.shoulderX, P.shoulderY, 0)
    arm.rotation.z = s * 0.17
    arm.userData.part = `arm${s}`
    root.add(arm)
    arms.push({ group: arm, side: s, baseX: s * P.shoulderX })

    muscle(arm, 'shoulders', 'upperArm', {
      pos: [-s * 0.004, -0.03, 0],
      size: [0.05, 0.072, 0.054],
      gain: [0.6, 0.25, 0.55],
      push: [s * 0.012, 0.004, 0],
    })
    muscle(arm, 'biceps', 'upperArm', {
      pos: [0, -0.14, 0],
      capsule: [P.armR, 0.2],
      gain: [0.25, 0, 0.25],
    })
    muscle(arm, 'biceps', 'upperArm', {
      pos: [0, -0.14, 0.02],
      size: [0.036, 0.075, 0.036],
      gain: [0.55, 0.12, 0.75],
      push: [0, 0, 0.014],
    })
    muscle(arm, 'triceps', 'upperArm', {
      pos: [s * 0.004, -0.12, -0.02],
      size: [0.038, 0.085, 0.038],
      gain: [0.5, 0.1, 0.7],
      push: [0, 0, -0.012],
    })

    const forearm = new THREE.Group()
    forearm.position.set(0, -0.285, 0)
    forearm.rotation.x = -0.14
    arm.add(forearm)

    muscle(forearm, 'forearms', 'forearm', {
      pos: [0, -0.12, 0],
      capsule: [P.armR * 0.82, 0.2],
      gain: [0.25, 0, 0.25],
    })
    muscle(forearm, 'forearms', 'forearm', {
      pos: [0, -0.07, 0.004],
      size: [0.04, 0.085, 0.036],
      gain: [0.45, 0.08, 0.45],
    })
    bodyPart(forearm, 'hand', { pos: [0, -0.275, 0.008], size: [0.024, 0.055, 0.042] })

    if (look.extra === 'wristbands') {
      const band = new THREE.Mesh(geo(new THREE.TorusGeometry(P.armR * 0.95, 0.013, 10, 28)), extra)
      band.position.set(0, -0.215, 0)
      band.rotation.x = Math.PI / 2
      forearm.add(band)
    }
  })

  // ---------- ноги ----------

  ;[1, -1].forEach((s) => {
    const leg = new THREE.Group()
    leg.position.set(s * P.hipX, 0.9, 0)
    leg.rotation.z = s * 0.03
    leg.userData.part = `leg${s}`
    root.add(leg)

    muscle(leg, 'quads', 'thigh', {
      pos: [0, -0.2, 0],
      capsule: [P.thighR, 0.3],
      gain: [0.22, 0, 0.22],
    })
    muscle(leg, 'quads', 'thigh', {
      pos: [s * 0.006, -0.19, 0.026],
      size: [0.066, 0.16, 0.058],
      gain: [0.4, 0.06, 0.45],
      push: [0, 0, 0.01],
    })
    muscle(leg, 'quads', 'thigh', {
      pos: [-s * 0.03, -0.33, 0.03],
      size: [0.034, 0.05, 0.034],
      gain: [0.6, 0.3, 0.6],
      push: [-s * 0.004, 0, 0.004],
      blend: 0.016,
    })
    muscle(leg, 'hamstrings', 'thigh', {
      pos: [0, -0.2, -0.03],
      size: [0.058, 0.15, 0.052],
      gain: [0.35, 0.05, 0.5],
      push: [0, 0, -0.01],
    })

    const shin = new THREE.Group()
    shin.position.set(0, -0.42, 0)
    leg.add(shin)

    muscle(shin, 'calves', 'shin', {
      pos: [0, -0.2, 0],
      capsule: [0.045, 0.3],
      gain: [0.2, 0, 0.2],
    })
    muscle(shin, 'calves', 'shin', {
      pos: [0, -0.11, -0.026],
      size: [0.054, 0.1, 0.05],
      gain: [0.5, 0.1, 0.6],
      push: [0, 0, -0.012],
    })

    bodyPart(shin, 'foot', { pos: [0, -0.425, 0.04], size: [0.045, 0.036, 0.1] })

    if (look.shoes !== 'none') {
      const soleMesh = new THREE.Mesh(geo(new THREE.BoxGeometry(0.094, 0.022, 0.21)), sole)
      soleMesh.position.set(0, -0.458, 0.04)
      shin.add(soleMesh)
      if (look.shoes === 'lifters') {
        // Штангетка узнаётся по жёсткому каблуку и ремешку через подъём.
        const heel = new THREE.Mesh(geo(new THREE.BoxGeometry(0.096, 0.035, 0.08)), sole)
        heel.position.set(0, -0.44, -0.03)
        shin.add(heel)
        const strapMaterial = mat(makeMaterial('#1b1b1e', { roughness: 0.7 }))
        const strap = new THREE.Mesh(geo(new THREE.TorusGeometry(0.047, 0.009, 8, 24)), strapMaterial)
        strap.position.set(0, -0.415, 0.05)
        strap.rotation.set(0.25, 0, 0)
        strap.scale.set(1, 0.75, 1)
        shin.add(strap)
      }
    }

    if (look.bottom === 'joggers') {
      const cuff = new THREE.Mesh(geo(new THREE.TorusGeometry(0.05, 0.012, 10, 28)), bottom)
      cuff.position.set(0, -0.37, 0)
      cuff.rotation.x = Math.PI / 2
      shin.add(cuff)
    }
  })

  // ---------- одежда поверх ----------

  if (['tee', 'longsleeve', 'hoodie'].includes(look.top)) {
    const collar = new THREE.Mesh(geo(new THREE.TorusGeometry(0.062, 0.011, 10, 32)), top)
    collar.position.set(0, 1.455, 0.005)
    collar.rotation.x = Math.PI / 2 - 0.15
    root.add(collar)
  }

  if (look.top === 'hoodie') {
    ellipsoid(root, { pos: [0, 1.47, -0.075], size: [0.12, 0.075, 0.065], material: top })
    ellipsoid(root, { pos: [0, 1.02, 0.092], size: [0.1, 0.045, 0.018], material: top })
  }

  // ---------- волосы и головной убор ----------

  function cap(parent, { pos, size, rot = [0, 0, 0], thetaLength = Math.PI * 0.55, material }) {
    const mesh = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, thetaLength)), material)
    mesh.position.set(...pos)
    mesh.scale.set(...size)
    mesh.rotation.set(...rot)
    parent.add(mesh)
    return mesh
  }

  const hidesHair = look.head === 'beanie'
  if (look.hair !== 'none' && !hidesHair) {
    const fuller = ['short', 'bun', 'ponytail', 'long', 'afro'].includes(look.hair)
    cap(root, {
      pos: [0, headY, -0.004],
      size: fuller ? [r * 0.99, r * 1.17, r * 1.07] : [r * 0.96, r * 1.15, r * 1.04],
      rot: [-0.5, 0, 0],
      thetaLength: Math.PI * (fuller ? 0.44 : 0.4),
      material: hair,
    })
    if (look.hair === 'mohawk') {
      ellipsoid(root, { pos: [0, headY + r * 1.02, -0.012], size: [0.016, 0.05, 0.11], rot: [-0.2, 0, 0], material: hair })
    }
    if (look.hair === 'bun') {
      ellipsoid(root, { pos: [0, headY + r * 0.85, -r * 0.65], size: [0.045, 0.042, 0.045], material: hair })
    }
    if (look.hair === 'ponytail') {
      const tail = new THREE.Group()
      tail.position.set(0, headY + r * 0.42, -r * 0.92)
      tail.rotation.x = 0.35
      ellipsoid(tail, { pos: [0, -0.09, 0], size: [0.028, 0.11, 0.028], material: hair })
      ellipsoid(tail, { pos: [0, 0, 0], size: [0.03, 0.022, 0.03], material: extra })
      root.add(tail)
    }
  }

  if (look.head === 'headband') {
    const band = new THREE.Mesh(geo(new THREE.TorusGeometry(r * 0.95, 0.013, 10, 36)), headwear)
    band.position.set(0, headY + r * 0.42, 0)
    band.rotation.x = Math.PI / 2 - 0.12
    band.scale.set(0.97, 1.06, 1)
    root.add(band)
  }

  if (look.head === 'cap') {
    cap(root, { pos: [0, headY + r * 0.22, -0.004], size: [r * 1.03, r * 0.93, r * 1.09], rot: [-0.12, 0, 0], thetaLength: Math.PI / 2, material: headwear })
    ellipsoid(root, { pos: [0, headY + r * 0.28, r * 1.0], size: [r * 0.82, 0.007, r * 0.62], rot: [0.12, 0, 0], material: headwear })
  }

  if (look.head === 'beanie') {
    cap(root, { pos: [0, headY + r * 0.06, -0.004], size: [r * 1.05, r * 1.25, r * 1.09], rot: [-0.18, 0, 0], thetaLength: Math.PI * 0.55, material: headwear })
    const cuff = new THREE.Mesh(geo(new THREE.TorusGeometry(r * 1.0, 0.022, 10, 36)), headwear)
    cuff.position.set(0, headY + r * 0.18, -0.004)
    cuff.rotation.x = Math.PI / 2 - 0.18
    root.add(cuff)
  }

  if (look.head === 'laurel') {
    // Венок открыт спереди, листья идут от затылка к вискам.
    const wreath = new THREE.Group()
    wreath.position.set(0, headY + r * 0.38, -0.004)
    wreath.rotation.x = -0.15
    for (let i = 0; i < 22; i += 1) {
      const t = (i / 21) * Math.PI * 1.55 + Math.PI * 0.225
      const angle = t + Math.PI / 2
      const radius = r * 1.0
      ;[1, -1].forEach((layer) => {
        const mesh = new THREE.Mesh(sphere, leaf)
        mesh.position.set(Math.cos(angle) * radius, layer * 0.008, Math.sin(angle) * radius)
        mesh.scale.set(0.009, 0.005, 0.024)
        mesh.rotation.set(layer * 0.5, -angle, 0)
        wreath.add(mesh)
      })
    }
    root.add(wreath)
  }

  // ---------- аксессуары ----------

  if (look.extra === 'belt') {
    const beltMaterial = mat(makeMaterial(look.extraHex, { roughness: 0.7 }))
    beltMaterial.side = THREE.DoubleSide
    const belt = new THREE.Mesh(geo(new THREE.CylinderGeometry(1, 1, 0.075, 40, 1, true)), beltMaterial)
    belt.position.set(0, 0.995, 0)
    belt.scale.set(P.waistW * 1.06, 1, 0.102)
    root.add(belt)
    const buckle = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, 0.04, 0.012)), gold)
    buckle.position.set(0, 0.995, 0.104)
    root.add(buckle)
  }

  if (look.extra === 'medal') {
    const disc = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.03, 0.007, 32)), gold)
    disc.rotation.x = Math.PI / 2
    disc.position.set(0, 1.19, 0.13)
    root.add(disc)
    const ribbonMat = mat(makeMaterial('#8e2f33', { roughness: 0.8 }))
    ;[1, -1].forEach((s) => {
      const from = new THREE.Vector3(s * 0.05, 1.47, 0.03)
      const to = new THREE.Vector3(s * 0.008, 1.215, 0.129)
      const length = from.distanceTo(to)
      const ribbon = new THREE.Mesh(geo(new THREE.BoxGeometry(0.016, length, 0.003)), ribbonMat)
      ribbon.position.copy(from).lerp(to, 0.5)
      ribbon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize())
      root.add(ribbon)
    })
  }

  // ---------- кожа ----------

  // Кожа строится в воркере, а без него (тесты, старые браузеры) — тут же.
  let grid = null
  let worker = null
  try {
    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./sdfWorker.js', import.meta.url), { type: 'module' })
    }
  } catch {
    worker = null
  }
  let busy = false
  let queued = false
  let disposed = false
  const skinMaterial = mat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66 }))
  const body = new THREE.Mesh(new THREE.BufferGeometry(), skinMaterial)
  root.add(body)
  pickables.push(body)

  let vertexRegions = []
  let baseColors = null
  let glowKey = ''
  const rootInverse = new THREE.Matrix4()
  const relative = new THREE.Matrix4()
  const placement = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const unit = new THREE.Vector3(1, 1, 1)
  const corner = new THREE.Vector3()

  // Примитив каркаса → описание для sdfBody: обратная матрица без масштаба,
  // размеры и рамка в пространстве фигуры.
  function describe(prim) {
    relative.multiplyMatrices(rootInverse, prim.node.matrixWorld)
    relative.decompose(position, quaternion, scale)
    placement.compose(position, quaternion, unit)
    const out = { kind: prim.kind, part: prim.part, blend: prim.blend }
    let extent
    if (prim.kind === 'capsule') {
      out.r = (prim.baseR * (scale.x + scale.z)) / 2
      out.h = prim.baseH * scale.y
      extent = [out.r, out.h + out.r, out.r]
    } else {
      out.radii = [scale.x, scale.y, scale.z]
      extent = out.radii
    }
    out.inv = placement.clone().invert().elements
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (let i = 0; i < 8; i += 1) {
      corner
        .set(i & 1 ? extent[0] : -extent[0], i & 2 ? extent[1] : -extent[1], i & 4 ? extent[2] : -extent[2])
        .applyMatrix4(placement)
      box[0] = Math.min(box[0], corner.x)
      box[1] = Math.min(box[1], corner.y)
      box[2] = Math.min(box[2], corner.z)
      box[3] = Math.max(box[3], corner.x)
      box[4] = Math.max(box[4], corner.y)
      box[5] = Math.max(box[5], corner.z)
    }
    out.box = box
    return out
  }

  function rebuild() {
    // Пока воркер занят, запоминаем, что нужна ещё одна сборка: по её
    // окончании возьмём уже самые свежие размеры мышц.
    if (busy) {
      queued = true
      return
    }
    root.updateMatrixWorld(true)
    rootInverse.copy(root.matrixWorld).invert()
    const described = prims.map(describe)
    const options = { partBlend: PART_BLEND, crossBlend: CROSS_BLEND }

    if (worker) {
      busy = true
      worker.postMessage({ gridSpec: GRID, prims: described, options })
      return
    }
    if (!grid) grid = createGrid(GRID)
    fillField(grid, described, options)
    applyMesh(surfaceNets(grid))
  }

  if (worker) {
    worker.onmessage = ({ data }) => {
      busy = false
      if (disposed) return
      applyMesh(data)
      if (queued) {
        queued = false
        rebuild()
      }
    }
    worker.onerror = () => {
      // Воркер не поднялся (например, CSP) — дальше строим в основном потоке.
      worker.terminate()
      worker = null
      busy = false
      rebuild()
    }
  }

  function applyMesh(mesh) {
    const count = mesh.positions.length / 3
    baseColors = new Float32Array(count * 3)
    vertexRegions = new Array(count)
    for (let i = 0; i < count; i += 1) {
      const prim = prims[mesh.owners[i]]
      const color = zoneMaterial(prim?.zone).color
      baseColors[i * 3] = color.r
      baseColors[i * 3 + 1] = color.g
      baseColors[i * 3 + 2] = color.b
      vertexRegions[i] = prim?.region || null
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(baseColors.slice(), 3))
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geometry.computeVertexNormals()
    body.geometry.dispose()
    body.geometry = geometry
    glowKey = ''
  }

  // Наведение мыши: какая мышца под курсором (см. avatarScene.js).
  body.userData.regionOf = (hit) => (hit.face ? vertexRegions[hit.face.a] : null)

  // Подсветка — подмешиваем золото в цвет вершин нужной группы. Буфер
  // переписывается, только когда яркость реально изменилась.
  function applyGlow(intensity) {
    if (!baseColors) return
    const key = Object.entries(intensity)
      .map(([k, v]) => `${k}:${v.toFixed(2)}`)
      .join('|')
    if (key === glowKey) return
    glowKey = key
    const colors = body.geometry.getAttribute('color')
    const array = colors.array
    for (let i = 0; i < vertexRegions.length; i += 1) {
      const t = intensity[vertexRegions[i]] || 0
      const j = i * 3
      array[j] = baseColors[j] + (GOLD.r - baseColors[j]) * t
      array[j + 1] = baseColors[j + 1] + (GOLD.g - baseColors[j + 1]) * t
      array[j + 2] = baseColors[j + 2] + (GOLD.b - baseColors[j + 2]) * t
    }
    colors.needsUpdate = true
  }

  // ---------- обновление ----------

  const effective = {}
  const built = {}
  let lastBuild = -Infinity

  function update({ growth = {}, pump = {}, highlight = null, time = 0 }) {
    let changed = !baseColors
    muscles.forEach((m) => {
      const g = (growth[m.region] || 0) * P.gain + (pump[m.region] || 0) * 0.07
      effective[m.region] = g
      if (Math.abs((built[m.region] ?? -1) - g) > REBUILD_EPSILON) changed = true
    })

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const interval = worker ? 0 : REBUILD_INTERVAL_MS
    if (changed && !busy && now - lastBuild >= interval) {
      muscles.forEach((m) => {
        const g = effective[m.region]
        built[m.region] = g
        m.node.scale.set(
          m.baseScale.x * (1 + m.gain.x * g),
          m.baseScale.y * (1 + m.gain.y * g),
          m.baseScale.z * (1 + m.gain.z * g),
        )
        m.node.position.set(m.basePos.x + m.push.x * g, m.basePos.y + m.push.y * g, m.basePos.z + m.push.z * g)
      })
      // Широкие плечи — сумма дельт и спины: руки разводятся вместе с ними.
      const width = (effective.shoulders || 0) * 0.016 + (effective.back || 0) * 0.012
      arms.forEach((arm) => {
        arm.group.position.x = arm.baseX + arm.side * width
      })
      rebuild()
      lastBuild = now
      changed = false
    }

    const pulse = 0.5 + 0.5 * Math.sin(time * 4)
    const intensity = {}
    Object.keys(effective).forEach((region) => {
      const lit = highlight === region ? 0.28 + 0.22 * pulse : 0
      intensity[region] = Math.min(0.7, (pump[region] || 0) * 0.16 + lit)
    })
    applyGlow(intensity)
    // true — кожа ещё не догнала рост: сцене нужен следующий кадр.
    return changed || busy || queued
  }

  function dispose() {
    disposed = true
    worker?.terminate()
    body.geometry.dispose()
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
  }

  return { root, update, dispose, pickables }
}
