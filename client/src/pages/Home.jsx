import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import TiltCard from '../components/TiltCard.jsx'
import TrainingCalendar from '../components/TrainingCalendar.jsx'
import ProgressChart from '../components/ProgressChart.jsx'

const pillars = [
  {
    title: 'Дисциплина',
    text: 'Результат живёт в постоянстве. Мотивация проходит — система остаётся.',
  },
  {
    title: 'Прогресс',
    text: 'Каждая тренировка фиксируется. Каждая цифра работает на историю.',
  },
  {
    title: 'Контроль',
    text: 'Ты выбираешь нагрузку, темп и путь. Инструмент лишь исполняет решение.',
  },
  {
    title: 'Точность',
    text: 'Форма важнее числа на штанге. Библиотека упражнений строится вокруг техники.',
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
    text: 'Готовые многонедельные программы — курируются вручную, без случайных подборок.',
    icon: 'programs',
  },
  {
    to: '/exercises',
    title: 'Библиотека упражнений',
    text: 'Полная база движений с разбивкой по группам мышц и инвентарю.',
    icon: 'library',
  },
  {
    to: '/workouts',
    title: 'Свои тренировки',
    text: 'Собери план из библиотеки и веди точный лог каждого подхода.',
    icon: 'workouts',
  },
]

const aiFeatures = [
  {
    to: '/workouts/ai',
    title: 'ИИ-тренер',
    text: 'Опиши цель, уровень и инвентарь — ИИ соберёт программу тренировок за минуту.',
    icon: 'ai',
  },
  {
    to: '/nutrition',
    title: 'Питание',
    text: 'Сфотографируй блюдо — ИИ оценит калории, белки, жиры и углеводы.',
    icon: 'nutrition',
  },
]

const steps = [
  {
    title: 'Регистрация',
    text: 'Аккаунт за минуту — почта или Google, без лишних анкет.',
  },
  {
    title: 'Выбор пути',
    text: 'Готовая программа, своя тренировка из библиотеки — или план от ИИ-тренера.',
  },
  {
    title: 'Учёт прогресса',
    text: 'Каждый подход, вес и приём пищи фиксируются — виден реальный прогресс, а не ощущение.',
  },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const DEMO_SESSIONS = [2, 4, 7, 9, 12, 16, 19, 23].map((n) => ({
  date: daysAgo(n),
  durationMinutes: 45 + (n % 3) * 10,
}))

const DEMO_POINTS = [
  { label: 'Нед. 1', value: 60 },
  { label: 'Нед. 3', value: 65 },
  { label: 'Нед. 5', value: 67.5 },
  { label: 'Нед. 7', value: 72.5 },
  { label: 'Нед. 9', value: 80 },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <>
      <section className="hero hero--photo">
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="eyebrow">Askesis · Система тренировок</span>
          <h1>Твой план.<br />Твоё развитие.</h1>
          <p>Профессиональные программы тренировок, библиотека упражнений и точный учёт прогресса — без лишнего шума.</p>
          <div className="hero__actions">
            {user ? (
              <Link to="/workouts" className="button">Мои тренировки</Link>
            ) : (
              <Link to="/register" className="button">Начать</Link>
            )}
            <Link to="/programs" className="button--ghost">Смотреть программы</Link>
          </div>
          <div className="hero__meta">
            <span>
              <strong>800+</strong>
              упражнений в базе
            </span>
            <span>
              <strong>100%</strong>
              контроль над нагрузкой
            </span>
            <span>
              <strong>∞</strong>
              история прогресса
            </span>
          </div>
        </div>
      </section>

      <section className="showcase">
        <div className="section-heading">
          <h2>Не обещания — интерфейс</h2>
          <p>Так выглядит личный кабинет: календарь тренировок и график силового прогресса.</p>
        </div>
        <div className="glass-hero showcase__panel">
          <div className="glass-hero__glow" />
          <div className="glass-hero__content">
            <div className="showcase__grid">
              <div>
                <span className="showcase__label">Когда вы тренировались</span>
                <TrainingCalendar sessions={DEMO_SESSIONS} />
              </div>
              <div>
                <span className="showcase__label">Жим лёжа, рабочий вес</span>
                <ProgressChart points={DEMO_POINTS} unit="кг" />
                <div className="stat-cards showcase__stats">
                  <div className="stat-card">
                    <strong>+20 кг</strong>
                    за 9 недель
                  </div>
                  <div className="stat-card">
                    <strong>8</strong>
                    тренировок в месяц
                  </div>
                </div>
              </div>
            </div>
            <p className="showcase__caption">Иллюстрация интерфейса — ваши данные и график будут собственными.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Философия</h2>
          <p>Четыре принципа, на которых строится каждая тренировка в системе.</p>
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
          <p>Всё необходимое, чтобы перейти от намерения к результату.</p>
        </div>
        <div className="feature-grid">
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
          <span className="eyebrow">Плюс — искусственный интеллект</span>
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

      <section>
        <div className="section-heading">
          <h2>Как это работает</h2>
          <p>От регистрации до первой записи в дневнике — три шага.</p>
        </div>
        <div className="process">
          {steps.map((s, i) => (
            <div className="process__step" key={s.title}>
              <span className="process__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <span className="eyebrow">Присоединиться</span>
        <h2>{user ? 'Продолжай движение' : 'Начни путь к дисциплине'}</h2>
        <p>
          {user
            ? 'Загляни в личный кабинет — там свежая статистика и история твоих тренировок.'
            : 'Регистрация занимает минуту. Дальше — только ты, план и результат.'}
        </p>
        <div className="hero__actions">
          {user ? (
            <Link to="/profile" className="button">Открыть профиль</Link>
          ) : (
            <>
              <Link to="/register" className="button">Создать аккаунт</Link>
              <Link to="/login" className="button--ghost">Уже есть аккаунт</Link>
            </>
          )}
        </div>
        {!user && (
          <p className="cta-band__note">Бесплатно · Без рекламы · Ваши данные остаются только у вас</p>
        )}
      </section>
    </>
  )
}
