import { useEffect, useState } from 'react'
import { api } from '../../api/firestore.js'

const emptyForm = { id: null, name: '', muscleGroup: '', equipment: '', instructions: '', imageUrl: '' }

export default function AdminExercises() {
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function load() {
    api.listExercises().then(setExercises).catch((e) => setError(e.message))
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
    setError(null)
    setSaving(true)
    try {
      if (form.id) {
        await api.updateExercise(form)
      } else {
        await api.createExercise(form)
      }
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setError(null)
    try {
      await api.deleteExercise({ id })
      load()
    } catch (err) {
      setError(err.message)
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

      <ul className="admin-list">
        {exercises.map((ex) => (
          <li key={ex.id}>
            <span>{ex.name} <small>({ex.muscleGroup})</small></span>
            <span className="admin-list__actions">
              <button type="button" onClick={() => startEdit(ex)}>Изменить</button>
              <button type="button" onClick={() => handleDelete(ex.id)}>Удалить</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
