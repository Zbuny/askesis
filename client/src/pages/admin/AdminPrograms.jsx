import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/firestore.js'
import { exerciseName, translateEquipment, translateMuscle } from '../../utils/translate.js'
import { emptyFilters, filterExercises } from '../../utils/exerciseFilters.js'
import { programItems } from '../../utils/programItems.js'
import ExerciseFilterBar from '../../components/ExerciseFilterBar.jsx'

const emptyForm = { id: null, title: '', level: '', duration: '', description: '', items: [] }

export default function AdminPrograms() {
  const [programs, setPrograms] = useState([])
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [filters, setFilters] = useState(emptyFilters)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function load() {
    Promise.all([api.listPrograms(), api.listExercises()])
      .then(([p, ex]) => {
        setPrograms(p)
        setExercises(ex)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(load, [])

  const filtered = useMemo(() => filterExercises(exercises, filters), [exercises, filters])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  function startEdit(program) {
    setForm({
      id: program.id,
      title: program.title || '',
      level: program.level || '',
      duration: program.duration || '',
      description: program.description || '',
      items: programItems(program),
    })
  }

  function addExercise(ex) {
    if (form.items.some((item) => item.exerciseId === ex.id)) return
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { exerciseId: ex.id, targetSets: 3, targetReps: 10 }],
    }))
  }

  function removeExercise(exerciseId) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.exerciseId !== exerciseId) }))
  }

  function updateItem(exerciseId, field, value) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.exerciseId === exerciseId ? { ...item, [field]: value } : item)),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.items.length === 0) {
      setError('Добавьте хотя бы одно упражнение')
      return
    }
    setSaving(true)
    try {
      if (form.id) {
        await api.updateProgram(form)
      } else {
        await api.createProgram(form)
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
      await api.deleteProgram({ id })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <h2>Программы — админка</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          placeholder="Название"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          placeholder="Уровень"
          value={form.level}
          onChange={(e) => setForm({ ...form, level: e.target.value })}
        />
        <input
          placeholder="Длительность"
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
        />
        <textarea
          placeholder="Описание"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />

        <h3>Упражнения в программе ({form.items.length})</h3>
        {form.items.length === 0 && <p>Добавьте упражнения из списка ниже.</p>}
        <ul className="admin-list">
          {form.items.map((item) => {
            const ex = exerciseById.get(item.exerciseId)
            return (
              <li key={item.exerciseId}>
                <span>{ex ? exerciseName(ex) : item.exerciseId}</span>
                <span className="admin-list__actions">
                  <input
                    type="number"
                    min="1"
                    className="number-input"
                    value={item.targetSets}
                    onChange={(e) => updateItem(item.exerciseId, 'targetSets', Number(e.target.value))}
                    title="Подходы"
                  />
                  ×
                  <input
                    type="number"
                    min="1"
                    className="number-input"
                    value={item.targetReps}
                    onChange={(e) => updateItem(item.exerciseId, 'targetReps', Number(e.target.value))}
                    title="Повторы"
                  />
                  <button type="button" onClick={() => removeExercise(item.exerciseId)}>Убрать</button>
                </span>
              </li>
            )
          })}
        </ul>

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

      <h3>Библиотека упражнений</h3>
      <ExerciseFilterBar exercises={exercises} filters={filters} onChange={setFilters} />
      <ul className="admin-list">
        {filtered.map((ex) => (
          <li key={ex.id}>
            <span>{exerciseName(ex)} <small>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</small></span>
            <button type="button" onClick={() => addExercise(ex)}>Добавить</button>
          </li>
        ))}
      </ul>

      <h3>Все программы</h3>
      <ul className="admin-list">
        {programs.map((p) => (
          <li key={p.id}>
            <span>{p.title} <small>({p.level})</small></span>
            <span className="admin-list__actions">
              <button type="button" onClick={() => startEdit(p)}>Изменить</button>
              <button type="button" onClick={() => handleDelete(p.id)}>Удалить</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
