// Готовые наборы инвентаря.
//
// Список из двенадцати позиций пришёл из библиотеки упражнений, и для неё он
// правильный — там инвентарь это фильтр. Но в анкете он превращается в
// двенадцать галочек, из которых человек в зале отмечает одиннадцать: зал по
// определению и есть «всё сразу». Отмечать их по одной — работа без смысла,
// а пропустить шаг нельзя, программа собирается именно по инвентарю.
//
// Поэтому сверху стоят три набора, закрывающие почти все случаи, а сами
// галочки остаются ниже — для тех, у кого дома штанга, но нет гантелей.

// Ключи — значения поля equipment в каталоге (см. EQUIPMENT_RU в translate.js).
export const EQUIPMENT_PRESETS = [
  {
    key: 'gym',
    label: 'Тренажёрный зал',
    hint: 'Штанга, гантели, блоки, тренажёры — всё, что есть в обычном зале',
    items: [
      'barbell',
      'dumbbell',
      'cable',
      'machine',
      'body only',
      'e-z curl bar',
      'kettlebells',
      'bands',
      'exercise ball',
      'medicine ball',
      'other',
    ],
  },
  {
    key: 'home',
    label: 'Дома с гантелями',
    hint: 'Гантели, резинки и свой вес',
    items: ['dumbbell', 'bands', 'body only', 'kettlebells', 'exercise ball'],
  },
  {
    key: 'bodyweight',
    label: 'Только свой вес',
    hint: 'Без инвентаря вообще',
    items: ['body only'],
  },
]

// Из набора берём только то, что реально встречается в каталоге: предлагать
// «гири», которых в библиотеке нет, — значит сузить подборку до пустоты.
export function presetEquipment(preset, available = []) {
  const inCatalogue = new Set(available)
  return preset.items.filter((item) => inCatalogue.has(item))
}

// Набор считается выбранным, когда отмечено ровно то, что в нём есть.
// Сравниваем как множества: порядок нажатий значения не имеет.
export function matchesPreset(preset, selected = [], available = []) {
  const items = presetEquipment(preset, available)
  if (items.length === 0 || items.length !== selected.length) return false
  return items.every((item) => selected.includes(item))
}

export function activePreset(selected = [], available = []) {
  return EQUIPMENT_PRESETS.find((preset) => matchesPreset(preset, selected, available)) || null
}
