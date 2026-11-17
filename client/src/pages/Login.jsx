import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { friendlyErrorMessage } from '../utils/errors.js'

export default function Login() {
  const { login, loginWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()
  // Адрес, с которого ProtectedRoute отправил сюда. Прямой заход на /login
  // состояния не несёт — тогда ведём в обзор: он отвечает на вопрос «что
  // делать сегодня», а профиль после первой настройки почти не открывают.
  const cameFrom = useLocation().state?.from
  const redirectTo = cameFrom || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy: submitting, error, setError, run } = useAsyncAction()
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await run(() => login(email, password))
      navigate(redirectTo, { replace: true })
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleGoogle() {
    try {
      await run(() => loginWithGoogle())
      navigate(redirectTo, { replace: true })
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError(null)
    setResetSent(false)
    if (!email) {
      setError('Введите email, на который прислать письмо для сброса пароля')
      return
    }
    setResetting(true)
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__inner">
          <div className="auth-card__mark" aria-hidden="true">
            <img src="/logo.png" alt="" />
          </div>

          <span className="eyebrow">Askesis · Вход</span>
          <h1>Добро пожаловать обратно</h1>
          <p className="auth-card__subtitle">Продолжай путь дисциплины и контроля.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="auth-card__submit" disabled={submitting}>
              {submitting ? 'Входим...' : 'Войти'}
            </button>
          </form>

          <p className="auth-card__footer">
            <button
              type="button"
              className="button--ghost"
              onClick={() => {
                setShowReset((v) => !v)
                setResetSent(false)
                setError(null)
              }}
            >
              Забыли пароль?
            </button>
          </p>

          {showReset && (
            <form onSubmit={handleReset}>
              <label className="field">
                <span>Email для сброса пароля</span>
                <input type="email" autoComplete="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button type="submit" className="auth-card__submit" disabled={resetting}>
                {resetting ? 'Отправляем...' : 'Отправить письмо для сброса'}
              </button>
              {resetSent && <p className="eyebrow">Письмо отправлено — проверьте почту.</p>}
            </form>
          )}

          <div className="auth-card__divider"><span>или</span></div>

          <button type="button" className="auth-card__google" onClick={handleGoogle} disabled={submitting}>
            Войти через Google
          </button>

          {error && <p className="error">{error}</p>}

          <p className="auth-card__footer">Нет аккаунта? <Link to="/register" state={cameFrom ? { from: cameFrom } : undefined}>Зарегистрироваться</Link></p>
        </div>
      </div>
    </div>
  )
}
