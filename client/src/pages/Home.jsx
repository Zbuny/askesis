import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import TiltCard from '../components/TiltCard.jsx'

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

const features = [
  {
    to: '/programs',
    title: 'Программы',
    text: 'Готовые многонедельные программы — курируются вручную, без случайных подборок.',
  },
  {
    to: '/exercises',
    title: 'Библиотека упражнений',
    text: 'Полная база движений с разбивкой по группам мышц и инвентарю.',
  },
  {
    to: '/workouts',
    title: 'Свои тренировки',
    text: 'Собери план из библиотеки и веди точный лог каждого подхода.',
  },
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
          {features.map((f, i) => (
            <TiltCard as={Link} to={f.to} className="feature-card" key={f.to}>
              <span className="feature-card__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="feature-card__arrow">Перейти →</span>
            </TiltCard>
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
      </section>
    </>
  )
}
