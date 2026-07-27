import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login, loginWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate('/profile')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await loginWithGoogle()
      navigate('/profile')
    } catch (err) {
      setError(err.message)
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
      setError(err.message)
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
          <h2>Добро пожаловать обратно</h2>
          <p className="auth-card__subtitle">Продолжай путь дисциплины и контроля.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="auth-card__submit">Войти</button>
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
                <input type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button type="submit" className="auth-card__submit" disabled={resetting}>
                {resetting ? 'Отправляем...' : 'Отправить письмо для сброса'}
              </button>
              {resetSent && <p className="eyebrow">Письмо отправлено — проверьте почту.</p>}
            </form>
          )}

          <div className="auth-card__divider"><span>или</span></div>

          <button type="button" className="auth-card__google" onClick={handleGoogle}>
            Войти через Google
          </button>

          {error && <p className="error">{error}</p>}

          <p className="auth-card__footer">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
        </div>
      </div>
    </div>
  )
}
