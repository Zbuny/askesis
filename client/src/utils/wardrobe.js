// Гардероб персонажа: что можно надеть и с какого уровня.
//
// Выбор хранится в профиле (users/{uid}.avatar) — это единственное, что
// человек задаёт руками. Уровень же, как и XP, производный и в базе не
// лежит, поэтому правила Firestore проверяют только форму записи, а
// замки проверяются здесь. Обойти их из консоли можно, но выиграть от
// этого нечего: одежда — косметика, она не меняет ни цифр, ни рекордов.
//
// normalizeAvatar() — единственная точка входа: что бы ни пришло из базы
// (старая версия, чужие ключи, вещь выше уровня), на выходе всегда целый
// и допустимый набор.

export const BODY_TYPES = [
  { id: 'm', label: 'Мужской' },
  { id: 'f', label: 'Женский' },
]

export const SKIN_TONES = [
  { id: 'porcelain', label: 'Светлый', hex: '#f1d3bd' },
  { id: 'sand', label: 'Песочный', hex: '#dcb08b' },
  { id: 'olive', label: 'Оливковый', hex: '#bf8f66' },
  { id: 'bronze', label: 'Бронзовый', hex: '#94633f' },
  { id: 'umber', label: 'Тёмный', hex: '#5e3d29' },
]

export const COLORS = [
  { id: 'graphite', label: 'Графит', hex: '#2a2b30' },
  { id: 'black', label: 'Чёрный', hex: '#121214' },
  { id: 'white', label: 'Белый', hex: '#e9e8e4' },
  { id: 'stone', label: 'Камень', hex: '#8d8a83' },
  { id: 'navy', label: 'Тёмно-синий', hex: '#22304f' },
  { id: 'sky', label: 'Небесный', hex: '#5b8fc7' },
  { id: 'olive', label: 'Олива', hex: '#56603b' },
  { id: 'crimson', label: 'Багровый', hex: '#8e2f33' },
  { id: 'coral', label: 'Коралл', hex: '#d86f5a' },
  { id: 'violet', label: 'Фиалка', hex: '#5d4a8a' },
  { id: 'gold', label: 'Золото', hex: '#c9a464', level: 10 },
]

export const HAIR_COLORS = [
  { id: 'black', label: 'Чёрные', hex: '#17130f' },
  { id: 'brown', label: 'Каштановые', hex: '#4a2f1f' },
  { id: 'chestnut', label: 'Рыжие', hex: '#8a4a26' },
  { id: 'blond', label: 'Светлые', hex: '#c9a66b' },
  { id: 'grey', label: 'Седые', hex: '#a7a6a2' },
]

// level — с какого уровня вещь открыта. body — для какого типа фигуры она
// есть (без поля — для любого).
export const SLOTS = [
  {
    key: 'top',
    label: 'Верх',
    colorKey: 'topColor',
    items: [
      { id: 'none', label: 'Без верха', level: 1, body: 'm' },
      { id: 'bra', label: 'Спортивный топ', level: 1, body: 'f' },
      { id: 'tank', label: 'Майка', level: 1 },
      { id: 'tee', label: 'Футболка', level: 1 },
      { id: 'longsleeve', label: 'Лонгслив', level: 3 },
      { id: 'hoodie', label: 'Худи', level: 8 },
    ],
  },
  {
    key: 'bottom',
    label: 'Низ',
    colorKey: 'bottomColor',
    items: [
      { id: 'shorts', label: 'Шорты', level: 1 },
      { id: 'joggers', label: 'Джоггеры', level: 1 },
      { id: 'tights', label: 'Тайтсы', level: 4 },
    ],
  },
  {
    key: 'shoes',
    label: 'Обувь',
    colorKey: 'shoesColor',
    items: [
      { id: 'none', label: 'Босиком', level: 1 },
      { id: 'sneakers', label: 'Кроссовки', level: 1 },
      { id: 'lifters', label: 'Штангетки', level: 6 },
    ],
  },
  {
    key: 'head',
    label: 'Голова',
    colorKey: 'headColor',
    items: [
      { id: 'none', label: 'Ничего', level: 1 },
      { id: 'headband', label: 'Повязка', level: 1 },
      { id: 'cap', label: 'Кепка', level: 2 },
      { id: 'beanie', label: 'Шапка', level: 5 },
      // Askesis — греческое слово, и высшая награда здесь греческая.
      { id: 'laurel', label: 'Лавровый венок', level: 30, fixedColor: true },
    ],
  },
  {
    key: 'hair',
    label: 'Причёска',
    colorKey: 'hairColor',
    palette: 'hair',
    items: [
      { id: 'none', label: 'Наголо', level: 1 },
      { id: 'buzz', label: 'Ёжик', level: 1 },
      { id: 'short', label: 'Короткая', level: 1 },
      { id: 'mohawk', label: 'Ирокез', level: 7 },
      { id: 'bun', label: 'Пучок', level: 1 },
      { id: 'ponytail', label: 'Хвост', level: 1 },
    ],
  },
  {
    key: 'extra',
    label: 'Аксессуар',
    colorKey: 'extraColor',
    items: [
      { id: 'none', label: 'Нет', level: 1 },
      { id: 'wristbands', label: 'Напульсники', level: 3 },
      { id: 'gloves', label: 'Перчатки', level: 5 },
      { id: 'belt', label: 'Атлетический пояс', level: 10 },
      { id: 'medal', label: 'Медаль', level: 20, fixedColor: true },
    ],
  },
]

export const AVATAR_KEYS = [
  'body',
  'skin',
  ...SLOTS.flatMap((slot) => [slot.key, slot.colorKey]),
]

const DEFAULTS = {
  m: {
    body: 'm',
    skin: 'sand',
    top: 'tee',
    topColor: 'stone',
    bottom: 'shorts',
    bottomColor: 'graphite',
    shoes: 'sneakers',
    shoesColor: 'white',
    head: 'none',
    headColor: 'black',
    hair: 'short',
    hairColor: 'brown',
    extra: 'none',
    extraColor: 'black',
  },
  f: {
    body: 'f',
    skin: 'sand',
    top: 'tank',
    topColor: 'violet',
    bottom: 'tights',
    bottomColor: 'black',
    shoes: 'sneakers',
    shoesColor: 'white',
    head: 'none',
    headColor: 'black',
    hair: 'ponytail',
    hairColor: 'brown',
    extra: 'none',
    extraColor: 'black',
  },
}

export function slotByKey(key) {
  return SLOTS.find((slot) => slot.key === key) || null
}

export function itemFits(item, body) {
  return !item.body || item.body === body
}

export function isUnlocked(item, level) {
  return (Number(level) || 1) >= (item?.level || 1)
}

export function paletteFor(slot) {
  return slot?.palette === 'hair' ? HAIR_COLORS : COLORS
}

// Вещи, которые откроются на следующих уровнях — для подсказки «что дальше».
export function nextUnlocks(level, body = 'm', limit = 3) {
  const current = Number(level) || 1
  const upcoming = []
  SLOTS.forEach((slot) => {
    slot.items.forEach((item) => {
      if (item.level > current && itemFits(item, body)) upcoming.push({ ...item, slot: slot.label })
    })
  })
  COLORS.forEach((color) => {
    if ((color.level || 1) > current) upcoming.push({ id: color.id, label: `Цвет «${color.label}»`, level: color.level, slot: 'Цвет' })
  })
  return upcoming.sort((a, b) => a.level - b.level).slice(0, limit)
}

export function defaultAvatar(sex) {
  return { ...DEFAULTS[sex === 'female' ? 'f' : 'm'] }
}

// Приводит что угодно к допустимому персонажу для данного уровня.
export function normalizeAvatar(raw, { level = 1, sex = null } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const body = BODY_TYPES.some((b) => b.id === source.body) ? source.body : sex === 'female' ? 'f' : 'm'
  const base = DEFAULTS[body]
  const result = { body }

  result.skin = SKIN_TONES.some((tone) => tone.id === source.skin) ? source.skin : base.skin

  SLOTS.forEach((slot) => {
    const item = slot.items.find((it) => it.id === source[slot.key])
    result[slot.key] = item && itemFits(item, body) && isUnlocked(item, level) ? item.id : base[slot.key]

    const color = paletteFor(slot).find((c) => c.id === source[slot.colorKey])
    result[slot.colorKey] = color && isUnlocked(color, level) ? color.id : base[slot.colorKey]
  })

  return result
}

export function sameAvatar(a, b) {
  return AVATAR_KEYS.every((key) => a?.[key] === b?.[key])
}

// Цвета в hex для сцены — сцена ничего не знает про id и уровни.
export function avatarLook(avatar) {
  const hexOf = (list, id) => list.find((entry) => entry.id === id)?.hex || '#888888'
  return {
    ...avatar,
    skinHex: hexOf(SKIN_TONES, avatar.skin),
    topHex: hexOf(COLORS, avatar.topColor),
    bottomHex: hexOf(COLORS, avatar.bottomColor),
    shoesHex: hexOf(COLORS, avatar.shoesColor),
    headHex: hexOf(COLORS, avatar.headColor),
    hairHex: hexOf(HAIR_COLORS, avatar.hairColor),
    extraHex: hexOf(COLORS, avatar.extraColor),
  }
}
