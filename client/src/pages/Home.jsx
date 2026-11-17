import { Link, Navigate } from 'react-router-dom'
import { hadSession, useAuth } from '../context/AuthContext.jsx'
import TiltCard from '../components/TiltCard.jsx'
import ProgressChart from '../components/ProgressChart.jsx'
import InstallApp from '../components/InstallApp.jsx'

// Все цифры на этой странице проверяемые: размер библиотеки — из импорта
// Free Exercise DB, число вопросов — из онбординга. Выдуманные «100%» и «∞»
// убраны: они ничего не обещали и ничего не объясняли.
const LIBRARY_SIZE = 873

// Одна тренировка изнутри — то, чего нет у обычного дневника: подсказка
// перед подходом, отдых после него и разбор в конце.
const sessionSteps = [
  {
    title: 'Чек-ин',
    text: 'Три вопроса: сон, энергия, забитость мышц. Если спал четыре часа, Askesis посоветует отложить прибавку веса.',
  },
  {
    title: 'Подход',
    text: 'Нажал на номер подхода, и пошёл отдых. Время зависит от упражнения, поправка на ±15 секунд запоминается. Экран не гаснет.',
  },
  {
    title: 'Запас',
    text: 'Отмечаешь, сколько повторов оставалось до отказа. По этому видно, где пора прибавлять, а где ты недорабатываешь.',
  },
  {
    title: 'Разбор',
    text: 'Рекорды, объём против прошлого раза, опыт и уровень. И цель на следующую тренировку по каждому упражнению.',
  },
]

const pillars = [
  {
    title: 'Дисциплина',
    text: 'Серия и недельная цель считаются по журналу. Пропущенную неделю видно сразу.',
  },
  {
    title: 'Прогресс',
    text: 'Вес растёт, когда добраны повторы во всех подходах. Правило одно и не меняется от настроения.',
  },
  {
    title: 'Контроль',
    text: 'Готовность и запас до отказа подсказывают, брать ли прибавку сегодня. Решаешь всё равно ты.',
  },
  {
    title: 'Точность',
    text: 'Замена упражнения подбирает аналог на ту же группу мышц и учитывает твои ограничения.',
  },
]

const ICONS = {
  programs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 9v6M20 9v6M2 10.5v3M22 10.5v3M7 12h10" />
    </svg>
  ),
  workouts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12.5l2 2 4-4.5" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  ),
  nutrition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13.2" r="3.2" />
    </svg>
  ),
}

const features = [
  {
    to: '/programs',
    title: 'Программы',
    text: 'Многонедельные программы, собранные вручную. Одна кнопка превращает программу в твою тренировку.',
    icon: 'programs',
  },
  {
    to: '/exercises',
    title: 'Библиотека упражнений',
    text: `${LIBRARY_SIZE} движений с фильтрами по мышцам, инвентарю и уровню. У каждого есть техника выполнения.`,
    icon: 'library',
  },
  {
    to: '/workouts',
    title: 'Свои тренировки',
    text: 'Собираешь план из библиотеки и двигаешь упражнения местами. Черновик не пропадёт, если закрыть вкладку.',
    icon: 'workouts',
  },
  {
    to: '/statistics',
    title: 'Статистика и цели',
    text: 'Объём по группам мышц, рекорды, календарь и цели вроде «жим 100 кг» с остатком до них.',
    icon: 'stats',
  },
]

const aiFeatures = [
  {
    to: '/workouts/ai',
    title: 'ИИ-тренер',
    text: 'Пять вопросов, и готова персональная программа. Посреди тренировки можно спросить про вес, отдых или замену.',
    icon: 'ai',
  },
  {
    to: '/nutrition',
    title: 'Сканер КБЖУ',
    text: 'Фото тарелки, и ИИ прикинет калории, белки, жиры и углеводы. Дневная норма считается из твоего профиля.',
    icon: 'nutrition',
  },
]

const faq = [
  {
    q: 'Это платно?',
    a: 'Нет. Askesis бесплатный и без рекламы: это личный проект для себя и друзей.',
  },
  {
    q: 'Работает без ИИ?',
    a: 'Да. Первая программа, подсказка веса, отдых, разбор и статистика считаются прямо в браузере. ИИ нужен только для тренера-собеседника и сканера еды.',
  },
  {
    q: 'Я новичок. С чего начать?',
    a: 'После регистрации Askesis спросит цель, опыт, частоту и инвентарь и соберёт первую программу из подходящих упражнений. У каждого упражнения есть техника.',
  },
  {
    q: 'А если в зале нет связи?',
    a: 'Введённые подходы сохраняются на телефоне. Запишешь тренировку, когда сеть вернётся, ничего перепечатывать не нужно.',
  },
  {
    q: 'Кто видит мои тренировки?',
    a: 'Только ты. Правила базы данных не дают другим пользователям читать твои записи.',
  },
]

const DEMO_POINTS = [
  { label: 'Нед. 1', value: 70 },
  { label: 'Нед. 3', value: 72.5 },
  { label: 'Нед. 5', value: 75 },
  { label: 'Нед. 7', value: 80 },
  { label: 'Нед. 9', value: 82.5 },
]

const DEMO_SETS = [
  { weight: '82,5', reps: '10', done: true },
  { weight: '82,5', reps: '9', done: true },
  { weight: '82,5', reps: '', done: false },
]

// Неподвижный слепок экрана тренировки. Не живой компонент: гостю нечего
// записывать, а поля, которые выглядят как настоящие, но не работают,
// только путают. Поэтому для скринридера здесь одно описание вместо макета.
function SessionDemo() {
  return (
    <figure className="session-demo">
      <div aria-hidden="true">
        <div className="session-demo__head">
          <span className="session-demo__index">
            02<small> / 05</small>
          </span>
          <strong className="session-demo__name">Жим лёжа</strong>
          <span className="session-demo__target">
            Сегодня: 82,5 кг × 8–10
            <span className="session-demo__take">Взять</span>
          </span>
          <small className="session-demo__hint">
            В прошлый раз все подходы по 10. Вес вырос на 2,5 кг.
          </small>
        </div>
        <div className="session-demo__sets">
          <div className="session-demo__row session-demo__row--head">
            <span>Подход</span>
            <span>Вес, кг</span>
            <span>Повторы</span>
          </div>
          {DEMO_SETS.map((set, i) => (
            <div className={`session-demo__row${set.done ? ' is-done' : ''}`} key={i}>
              <span className="session-demo__check">
                {set.done ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="session-demo__cell">{set.weight}</span>
              <span className={`session-demo__cell${set.reps ? '' : ' is-empty'}`}>{set.reps || '8'}</span>
            </div>
          ))}
        </div>
        <div className="session-demo__rest">
          <span className="session-demo__rest-bar" />
          <div>
            <span className="session-demo__rest-label">Отдых · Жим лёжа</span>
            <strong className="session-demo__rest-value">1:24</strong>
          </div>
          <span className="session-demo__rest-btn">−15</span>
          <span className="session-demo__rest-btn">+15</span>
        </div>
      </div>
      <figcaption className="visually-hidden">
        Пример экрана тренировки: подсказка «сегодня 82,5 кг на 8–10 повторов», два отмеченных подхода
        и таймер отдыха на минуту двадцать четыре.
      </figcaption>
    </figure>
  )
}

export default function Home() {
  const { user, loading } = useAuth()

  // Главная — витрина для гостя. Вошедшему она каждый раз пересказывала, что
  // такое Askesis, вместо того чтобы показать сегодняшнюю тренировку, —
  // поэтому сразу ведём в обзор. Пока сессия восстанавливается, пустой экран
  // получает только тот, кто здесь уже входил (см. hadSession).
  if (loading && hadSession()) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <>
      <section className="hero hero--photo">
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="eyebrow">Askesis · Дневник тренировок</span>
          <h1>Знай, какой вес<br />брать сегодня.</h1>
          <p>
            Askesis смотрит на твои прошлые подходы и подсказывает вес и повторы на каждое упражнение.
            Отметил подход, и пошёл отдых. После тренировки видно рекорды и цель на следующий раз.
          </p>
          {/* Каталоги закрыты для гостя, поэтому «Смотреть программы» вело на
              вход без объяснений. Вторая кнопка — честный путь для тех, у кого
              аккаунт уже есть. */}
          <div className="hero__actions">
            <Link to="/register" className="button">Начать бесплатно</Link>
            <Link to="/login" className="button--ghost">Уже есть аккаунт</Link>
          </div>
          <div className="hero__meta">
            <span>
              <strong>{LIBRARY_SIZE}</strong>
              упражнений с техникой
            </span>
            <span>
              <strong>4</strong>
              вопроса до первой программы
            </span>
            <span>
              <strong>0 ₽</strong>
              без рекламы и подписок
            </span>
          </div>
        </div>
      </section>

      <section className="showcase">
        <div className="section-heading">
          <h2>Так выглядит тренировка</h2>
          <p>Экран в зале и то, что из него получается через пару месяцев.</p>
        </div>
        <div className="glass-hero showcase__panel">
          <div className="glass-hero__glow" />
          <div className="glass-hero__content">
            <div className="showcase__grid">
              <div>
                <span className="showcase__label">В зале</span>
                <SessionDemo />
              </div>
              <div>
                <span className="showcase__label">Жим лёжа, рабочий вес</span>
                <ProgressChart points={DEMO_POINTS} unit="кг" />
                <div className="stat-cards showcase__stats">
                  <div className="stat-card">
                    <strong>+12,5 кг</strong>
                    за 9 недель
                  </div>
                  <div className="stat-card">
                    <strong>3</strong>
                    тренировки в неделю
                  </div>
                </div>
              </div>
            </div>
            <p className="showcase__caption">Цифры для примера. Твои появятся после первой записанной тренировки.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Одна тренировка, четыре шага</h2>
          <p>Дневник записывает, что ты сделал. Askesis ещё и подсказывает, что делать дальше.</p>
        </div>
        <div className="process process--four">
          {sessionSteps.map((s, i) => (
            <div className="process__step" key={s.title}>
              <span className="process__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Философия</h2>
          <p>Четыре принципа, и за каждым стоит конкретная функция.</p>
        </div>
        <div className="pillars">
          {pillars.map((p, i) => (
            <div className="pillar" key={p.title}>
              <span className="pillar__index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Возможности</h2>
          <p>От первой программы до графика силы за год.</p>
        </div>
        <div className="feature-grid feature-grid--four">
          {features.map((f) => (
            <TiltCard as={Link} to={f.to} className="feature-card" key={f.to}>
              <span className="feature-card__icon">{ICONS[f.icon]}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="feature-card__arrow">Перейти →</span>
            </TiltCard>
          ))}
        </div>

        <div className="feature-grid__ai-label">
          <span className="eyebrow">Плюс искусственный интеллект</span>
        </div>
        <div className="feature-grid feature-grid--ai">
          {aiFeatures.map((f) => (
            <TiltCard as={Link} to={f.to} className="feature-card feature-card--ai" key={f.to}>
              <span className="feature-card__tag">ИИ</span>
              <span className="feature-card__icon">{ICONS[f.icon]}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="feature-card__arrow">Перейти →</span>
            </TiltCard>
          ))}
        </div>
      </section>

      <section className="install">
        <div className="install__text">
          <span className="eyebrow">На телефоне</span>
          <h2>Поставь на главный экран</h2>
          <p>
            Askesis открывается как приложение: с иконкой, без адресной строки и сразу на обзоре.
            Ничего не нужно скачивать из магазина.
          </p>
        </div>
        <div className="install__action">
          <InstallApp />
        </div>
      </section>

      <section className="faq">
        <div className="section-heading">
          <h2>Вопросы</h2>
        </div>
        <div className="faq__list">
          {faq.map((item) => (
            <details className="faq__item" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <span className="eyebrow">Присоединиться</span>
        <h2>Четыре вопроса до первой тренировки</h2>
        <p>Регистрация по почте или через Google. Дальше Askesis спросит цель, опыт, частоту и инвентарь и соберёт программу.</p>
        <div className="hero__actions">
          <Link to="/register" className="button">Собрать первую программу</Link>
          <Link to="/login" className="button--ghost">Уже есть аккаунт</Link>
        </div>
        <p className="cta-band__note">Бесплатно · Без рекламы · Записи видишь только ты</p>
      </section>
    </>
  )
}
