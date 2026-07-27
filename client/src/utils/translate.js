const MUSCLE_RU = {
  abdominals: 'Пресс',
  abductors: 'Абдукторы',
  adductors: 'Аддукторы',
  biceps: 'Бицепс',
  calves: 'Икры',
  chest: 'Грудь',
  forearms: 'Предплечья',
  glutes: 'Ягодицы',
  hamstrings: 'Бицепс бедра',
  lats: 'Широчайшие',
  'lower back': 'Поясница',
  'middle back': 'Средняя часть спины',
  neck: 'Шея',
  quadriceps: 'Квадрицепс',
  shoulders: 'Плечи',
  traps: 'Трапеции',
  triceps: 'Трицепс',
}

const EQUIPMENT_RU = {
  bands: 'Резинки',
  barbell: 'Штанга',
  'body only': 'Свой вес',
  cable: 'Блок',
  dumbbell: 'Гантели',
  'e-z curl bar': 'EZ-гриф',
  'exercise ball': 'Фитбол',
  'foam roll': 'Массажный ролл',
  kettlebells: 'Гири',
  machine: 'Тренажёр',
  'medicine ball': 'Медбол',
  other: 'Другое',
}

const LEVEL_RU = {
  beginner: 'Начинающий',
  intermediate: 'Средний',
  expert: 'Продвинутый',
}

const CATEGORY_RU = {
  cardio: 'Кардио',
  'olympic weightlifting': 'Тяжёлая атлетика',
  plyometrics: 'Плиометрика',
  powerlifting: 'Пауэрлифтинг',
  strength: 'Силовое',
  stretching: 'Растяжка',
  strongman: 'Строгмен',
}

function fromDict(dict, value) {
  if (!value) return value
  return dict[value.toLowerCase()] || value
}

export const translateMuscle = (value) => fromDict(MUSCLE_RU, value)
export const translateEquipment = (value) => fromDict(EQUIPMENT_RU, value)
export const translateLevel = (value) => fromDict(LEVEL_RU, value)
export const translateCategory = (value) => fromDict(CATEGORY_RU, value)

export function pluralRu(count, one, few, many) {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export const exerciseName = (ex) => ex?.nameRu || ex?.name || ''
export const exerciseInstructions = (ex) => ex?.instructionsRu || ex?.instructions || ''
