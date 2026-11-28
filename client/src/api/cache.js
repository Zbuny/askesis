// Библиотека упражнений — 800+ документов, которые меняются раз в месяц, но
// нужны шести разным экранам (каталог, конструктор, ИИ-тренер, чат, обе
// админки). Без кэша каждый переход между ними — это ещё 800 чтений Firestore,
// то есть дневная квота Spark-плана (50k) сгорает примерно за 60 переходов.
//
// Кэш двухслойный: в памяти живёт промис (значит, параллельные вызовы с одной
// страницы схлопываются в один запрос), в localStorage — сами данные, чтобы
// повторный заход и перезагрузка страницы обходились без сети вообще.

const STORE_PREFIX = 'askesis:cache:'

// Версия ломает старые записи, когда меняется форма данных: иначе после
// правки схемы пользователь неделю сидел бы на протухшем кэше.
const VERSION = 1

function storageKey(key) {
  return `${STORE_PREFIX}${key}`
}

// localStorage недоступен в приватном режиме части браузеров и может кинуть
// на записи при переполнении квоты. Кэш — это оптимизация, а не источник
// правды, поэтому любую его поломку глотаем и работаем через сеть.
function readStored(key, ttlMs) {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (entry.version !== VERSION) return null
    if (Date.now() - entry.savedAt > ttlMs) return null
    return entry.data
  } catch {
    return null
  }
}

function writeStored(key, data) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({ version: VERSION, savedAt: Date.now(), data }))
  } catch {
    // квота или приватный режим — не беда, останется кэш в памяти
  }
}

function dropStored(key) {
  try {
    localStorage.removeItem(storageKey(key))
  } catch {
    // см. выше
  }
}

/**
 * Оборачивает загрузчик списка в кэш.
 * @param {string} key       уникальное имя кэша (оно же ключ в localStorage)
 * @param {number} ttlMs     сколько localStorage-копия считается свежей
 * @param {() => Promise<any>} fetcher запрос за настоящими данными
 * @returns {{ read: () => Promise<any>, invalidate: () => void }}
 */
export function cachedList(key, ttlMs, fetcher) {
  let inflight = null

  function read() {
    // Массив копируем на каждой выдаче: список теперь общий для нескольких
    // экранов, и любая сортировка «на месте» у одного из них иначе
    // незаметно переписала бы кэш для всех остальных.
    if (inflight) return inflight.then((data) => (Array.isArray(data) ? [...data] : data))

    const stored = readStored(key, ttlMs)
    if (stored) {
      inflight = Promise.resolve(stored)
      return read()
    }

    inflight = fetcher()
      .then((data) => {
        writeStored(key, data)
        return data
      })
      .catch((err) => {
        // Неудачный запрос кэшировать нельзя — иначе одна потеря сети
        // залипнет на всю сессию и страница никогда не загрузится.
        inflight = null
        throw err
      })
    return read()
  }

  function invalidate() {
    inflight = null
    dropStored(key)
  }

  return { read, invalidate }
}
