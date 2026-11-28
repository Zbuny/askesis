import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PageLoading } from './PageState.jsx'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  // Сессия восстанавливается около секунды — каркас вместо пустого экрана,
  // иначе обновление страницы тренировки выглядит как поломка.
  if (loading) return <PageLoading />
  // Куда человек шёл, туда и вернём после входа. Раньше под защитой были
  // только личные разделы, и «в профиль» почти всегда угадывало; теперь сюда
  // же попадают каталоги, и гость с кнопки «К библиотеке упражнений» иначе
  // оказывался бы в профиле без всякой связи со своим кликом.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
