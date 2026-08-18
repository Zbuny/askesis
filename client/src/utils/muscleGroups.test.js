import { describe, it, expect } from 'vitest'
import { BODY_PARTS, bodyPartOf, bodyPartSections } from './muscleGroups.js'
import { emptyFilters, filterExercises } from './exerciseFilters.js'

const ex = (id, muscleGroup) => ({ id, name: id, muscleGroup, equipment: 'barbell' })

const library = [
  ex('bench', 'chest'),
  ex('press', 'shoulders'),
  ex('pushdown', 'triceps'),
  ex('row', 'middle back'),
  ex('curl', 'biceps'),
  ex('squat', 'quadriceps'),
  ex('calf', 'calves'),
  ex('crunch', 'abdominals'),
]

describe('разделы', () => {
  it('покрывают все 17 групп каталога и не пересекаются', () => {
    const all = BODY_PARTS.flatMap((z) => z.muscles)

    expect(all).toHaveLength(new Set(all).size)
    expect(all).toHaveLength(17)
  })

  it('находят раздел по группе мышц', () => {
    expect(bodyPartOf('triceps').key).toBe('arms')
    expect(bodyPartOf('lats').key).toBe('back')
    expect(bodyPartOf('glutes').key).toBe('legs')
    expect(bodyPartOf('abdominals').key).toBe('abs')
    expect(bodyPartOf('выдумка')).toBeNull()
  })
})

describe('bodyPartSections', () => {
  it('считает упражнения по разделам и группам', () => {
    const zones = bodyPartSections(library)
    const arms = zones.find((z) => z.key === 'arms')

    expect(arms.count).toBe(2)
    expect(arms.muscles.map((m) => m.key).sort()).toEqual(['biceps', 'triceps'])
  })

  it('пустые разделы и группы не показывает', () => {
    const zones = bodyPartSections([ex('bench', 'chest')])

    expect(zones.map((z) => z.key)).toEqual(['chest'])
    expect(zones[0].muscles).toEqual([{ key: 'chest', count: 1, cover: null }])
  })

  it('внутри раздела группы идут от больших к меньшим', () => {
    const many = [...Array(5)].map((_, i) => ex(`c${i}`, 'calves'))
    const zones = bodyPartSections([...many, ex('squat', 'quadriceps')])

    expect(zones.find((z) => z.key === 'legs').muscles[0].key).toBe('calves')
  })
})

describe('фильтр по разделу', () => {
  const by = (patch) => filterExercises(library, { ...emptyFilters, ...patch }).map((x) => x.id)

  it('отдаёт все группы раздела', () => {
    expect(by({ zone: 'arms' }).sort()).toEqual(['curl', 'pushdown'])
  })

  it('внутри раздела сужается до одной группы', () => {
    expect(by({ zone: 'back', muscleGroup: 'middle back' })).toEqual(['row'])
  })

  it('без раздела ничего не отсекает', () => {
    expect(by({})).toHaveLength(library.length)
  })

  it('несуществующий раздел не роняет фильтр и не режет выдачу', () => {
    expect(by({ zone: 'выдумка' })).toHaveLength(library.length)
  })
})

describe('обложка группы мышц', () => {
  const withImg = (id, muscleGroup, imageUrl) => ({ id, name: id, muscleGroup, imageUrl })

  it('берёт первое по алфавиту упражнение с картинкой', () => {
    const zones = bodyPartSections([
      withImg('zebra', 'chest', 'zebra.jpg'),
      withImg('alpha', 'chest', 'alpha.jpg'),
    ])

    // Не «любое»: иначе обложка прыгала бы вслед за порядком документов.
    expect(zones[0].muscles[0].cover).toBe('alpha.jpg')
  })

  it('упражнения без картинки в обложки не идут', () => {
    const zones = bodyPartSections([
      withImg('aaa', 'chest', null),
      withImg('bbb', 'chest', 'bbb.jpg'),
    ])

    expect(zones[0].muscles[0].cover).toBe('bbb.jpg')
  })

  it('без картинок вовсе отдаёт null, а не падает', () => {
    const zones = bodyPartSections([withImg('aaa', 'chest', null)])

    expect(zones[0].muscles[0].cover).toBeNull()
  })
})
