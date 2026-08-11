import { Component } from 'react'
import { useLocation } from 'react-router-dom'

// Без границы ошибок любое исключение при рендере роняет всё дерево целиком —
// пользователь видит пустую белую страницу и не понимает, сломался сайт или
// интернет. React ловит такие ошибки только классовым компонентом, отсюда
// class вместо привычных хуков.
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Аналитики в проекте нет, но в консоли стектрейс с именами компонентов
    // из info куда полезнее голого сообщения.
    console.error('Ошибка рендера:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="crash">
        <h2>Что-то пошло не так</h2>
        <p>Страница не открылась из-за ошибки в приложении. Остальные разделы должны работать.</p>
        <p className="error">{this.state.error.message}</p>
        <div className="crash__actions">
          <button type="button" onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </button>
          <button type="button" onClick={() => window.location.assign('/')}>
            На главную
          </button>
        </div>
      </section>
    )
  }
}

// Ключ по пути сбрасывает состояние ошибки при переходе: иначе один сломанный
// экран оставлял бы заглушку висеть на всех следующих страницах.
export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundaryInner key={pathname}>{children}</ErrorBoundaryInner>
}
