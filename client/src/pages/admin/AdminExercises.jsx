import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/firestore.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'
import { emptyFilters, filterExercises } from '../../utils/exerciseFilters.js'
import ExerciseFilterBar from '../../components/ExerciseFilterBar.jsx'

const emptyForm = { id: null, name: '', muscleGroup: '', equipment: '', instructions: '', imageUrl: '' }
const PAGE_SIZE = 40

export default function AdminExercises() {
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const { busy: saving, error, setError, run } = useAsyncAction()

  const [filters, setFilters] = useState(emptyFilters)
  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])

  // Список — 873 упражнения; рисуем порциями и сбрасываем счётчик при смене
  // фильтра, как в ExercisePicker (тот же паттерн, та же причина).
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lastFilters, setLastFilters] = useState(filters)
  if (lastFilters !== filters) {
    setLastFilters(filters)
    setVisibleCount(PAGE_SIZE)
  }

  function load() {
    api.listExercisesFull().then(setExercises).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  function startEdit(ex) {
    setForm({
      id: ex.id,
      name: ex.name || '',
      muscleGroup: ex.muscleGroup || '',
      equipment: ex.equipment || '',
      instructions: ex.instructions || '',
      imageUrl: ex.imageUrl || '',
    })
    // Список — все 873 упражнения подряд, форма — вверху страницы.
    // Без прокрутки клик по «Изменить» в конце списка выглядит так,
    // будто ничего не произошло.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await run(() => (form.id ? api.updateExercise(form) : api.createExercise(form)))
      setForm(emptyForm)
      load()
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Удалить упражнение «${name}»? Это действие необратимо.`)) return
    try {
      await run(() => api.deleteExercise({ id }))
      load()
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  return (
    <section>
      <h2>Упражнения — админка</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          placeholder="Название"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Группа мышц"
          value={form.muscleGroup}
          onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}
        />
        <input
          placeholder="Инвентарь"
          value={form.equipment}
          onChange={(e) => setForm({ ...form, equipment: e.target.value })}
        />
        <input
          placeholder="Ссылка на картинку"
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
        />
        <textarea
          placeholder="Инструкция по выполнению"
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          rows={3}
        />
        <div className="admin-form__actions">
          <button type="submit" disabled={saving}>
            {form.id ? 'Сохранить' : 'Добавить'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(emptyForm)}>
              Отмена
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} />
      <p className="picker__count">Найдено: {filtered.length}</p>

      <ul className="admin-list">
        {filtered.slice(0, visibleCount).map((ex) => (
          <li key={ex.id}>
            <span>{ex.name} <small>({ex.muscleGroup})</small></span>
            <span className="admin-list__actions">
              <button type="button" onClick={() => startEdit(ex)}>Изменить</button>
              <button type="button" className="is-danger" onClick={() => handleDelete(ex.id, ex.name)}>Удалить</button>
            </span>
          </li>
        ))}
      </ul>
      {visibleCount < filtered.length && (
        <button type="button" className="picker__more" onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
          Показать ещё ({filtered.length - visibleCount})
        </button>
      )}
    </section>
  )
}
