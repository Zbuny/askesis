import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import BrandMark from '../components/BrandMark.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  // См. Login.jsx: возвращаем туда, откуда человека увели на авторизацию.
  const cameFrom = useLocation().state?.from
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const { busy: submitting, error, setError, run } = useAsyncAction()

  // Отметку о согласии ставим один раз и только если её ещё нет: через
  // «Войти через Google» на эту страницу заходит и тот, кто регистрировался
  // раньше, — его исходную дату затирать нельзя.
  // Firestore тянем динамически: страница входа не должна тащить его SDK
  // в стартовый бандл (см. AuthContext).
  //
  // Заодно отвечает, нужен ли человеку онбординг: профиль здесь всё равно
  // читается, и отдельный запрос ради того же ответа был бы лишним.
  async function recordConsent() {
    try {
      const { api } = await import('../api/firestore.js')
      const profile = await api.getMyProfileData()
      if (!profile.dataConsentAt) {
        await api.updateMyProfileData({ dataConsentAt: new Date().toISOString() })
      }
      return !profile.onboardedAt
    } catch {
      // Аккаунт уже создан, и галочку человек поставил — не ломаем вход
      // из-за неудачной записи отметки. Онбординг в этом случае не навязываем.
      return false
    }
  }

  // Если человека увели на регистрацию с конкретной страницы, туда и
  // возвращаем: анкета важна, но не важнее того, зачем он сюда шёл.
  function destination(needsOnboarding) {
    if (cameFrom) return cameFrom
    return needsOnboarding ? '/onboarding' : '/dashboard'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const needsOnboarding = await run(async () => {
        await register(name, email, password)
        return recordConsent()
      })
      navigate(destination(needsOnboarding), { replace: true })
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleGoogle() {
    // Кнопка Google живёт вне формы, поэтому required у чекбокса её не
    // прикрывает — проверяем согласие сами.
    if (!consent) {
      setError('Отметьте согласие на обработку персональных данных')
      return
    }
    try {
      const needsOnboarding = await run(async () => {
        await loginWithGoogle()
        return recordConsent()
      })
      navigate(destination(needsOnboarding), { replace: true })
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__inner">
          <div className="auth-card__mark" aria-hidden="true">
            <BrandMark variant="full" />
            <span className="brand-word">Askesis</span>
          </div>

          <span className="eyebrow">Askesis · Регистрация</span>
          <h1>Создать аккаунт</h1>
          <p className="auth-card__subtitle">Минута — и ты внутри системы.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Имя</span>
              <input autoComplete="given-name" placeholder="Как к тебе обращаться" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {/* Firebase не примет пароль короче шести символов — говорим об этом
                до отправки, а не ошибкой после. */}
            <label className="field">
              <span>Пароль · не короче 6 символов</span>
              <input type="password" autoComplete="new-password" minLength={6} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked)
                  // Иначе упрёк «отметьте согласие» висит уже после того,
                  // как человек его отметил.
                  if (e.target.checked) setError(null)
                }}
                required
              />
              <span>Я согласен на обработку персональных данных</span>
            </label>

            <button type="submit" className="button button--block auth-card__submit" disabled={submitting}>
              {submitting ? 'Создаём...' : 'Создать аккаунт'}
            </button>
          </form>

          <div className="auth-card__divider"><span>или</span></div>

          <button type="button" className="button button--secondary button--block auth-card__google" onClick={handleGoogle} disabled={submitting}>
            Войти через Google
          </button>

          {error && <p className="error">{error}</p>}

          <p className="auth-card__footer">Уже есть аккаунт? <Link to="/login" state={cameFrom ? { from: cameFrom } : undefined}>Войти</Link></p>
        </div>
      </div>
    </div>
  )
}
