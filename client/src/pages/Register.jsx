import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await register(name, email, password)
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__inner">
          <div className="auth-card__mark" aria-hidden="true">
            <img src="/logo.png" alt="" />
          </div>

          <span className="eyebrow">Askesis · Регистрация</span>
          <h2>Создать аккаунт</h2>
          <p className="auth-card__subtitle">Минута — и ты внутри системы.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Имя</span>
              <input placeholder="Как к тебе обращаться" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="auth-card__submit">Создать аккаунт</button>
          </form>

          <div className="auth-card__divider"><span>или</span></div>

          <button type="button" className="auth-card__google" onClick={handleGoogle}>
            Войти через Google
          </button>

          {error && <p className="error">{error}</p>}

          <p className="auth-card__footer">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
        </div>
      </div>
    </div>
  )
}
