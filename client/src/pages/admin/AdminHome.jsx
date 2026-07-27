import { Link } from 'react-router-dom'

export default function AdminHome() {
  return (
    <section>
      <h2>Админка</h2>
      <div className="admin-links">
        <Link to="/admin/exercises" className="button">Упражнения</Link>
        <Link to="/admin/programs" className="button">Программы</Link>
      </div>
    </section>
  )
}
