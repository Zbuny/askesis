import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/firestore.js'
import { exerciseName, translateEquipment, translateMuscle } from '../../utils/translate.js'
import { emptyFilters, filterExercises } from '../../utils/exerciseFilters.js'
import { formatReps, programItems } from '../../utils/programItems.js'
import ExerciseFilterBar from '../../components/ExerciseFilterBar.jsx'
import ExerciseAnimation from '../../components/ExerciseAnimation.jsx'
import { planFromChat } from '../../api/ai.js'

const emptyForm = { id: null, title: '', level: '', duration: '', description: '', items: [] }

export default function AdminPrograms() {
  const [programs, setPrograms] = useState([])
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [filters, setFilters] = useState(emptyFilters)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rawPlan, setRawPlan] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)

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

  // Как и в конструкторе: 873 карточки с картинками разом не рисуем.
  const [visibleCount, setVisibleCount] = useState(40)
  useEffect(() => setVisibleCount(40), [filters])
  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])

  // Разбор плана, вставленного текстом: модель раскладывает его на
  // упражнения библиотеки, а админ проверяет и правит перед сохранением.
  // Сразу в базу не пишем — программа видна всем, ошибку заметить важнее.
  async function handleParse() {
    setError(null)
    setParsing(true)
    setParsed(null)
    try {
      const result = await planFromChat({
        messages: [{ role: 'user', content: rawPlan }],
        exercises,
      })
      setParsed(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  function applyParsed(workout) {
    setForm((prev) => ({
      ...prev,
      title: prev.title || workout.title,
      items: workout.items.map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        ...(item.targetRepsMax ? { targetRepsMax: item.targetRepsMax } : {}),
      })),
    }))
    setParsed(null)
    setRawPlan('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

      <div className="ai-import">
        <div className="ai-import__head">
          <span className="ai-import__badge">ИИ-помощник</span>
          <p>Вставьте план текстом — разложим его на упражнения библиотеки и подставим в форму ниже.</p>
        </div>
        <textarea
          rows={5}
          placeholder={'День рук\nСгибания с гантелями 3 на 10\nЖим узким хватом 3 на 10\nРазгибания с канатом 3 на 8-10'}
          value={rawPlan}
          onChange={(e) => setRawPlan(e.target.value)}
        />
        <div className="ai-import__actions">
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !rawPlan.trim() || exercises.length === 0}
          >
            {parsing ? 'Разбираем...' : 'Разобрать план'}
          </button>
          {rawPlan && !parsing && (
            <button type="button" className="ai-import__clear" onClick={() => { setRawPlan(''); setParsed(null) }}>
              Очистить
            </button>
          )}
        </div>

        {parsed && (
          <div className="ai-import__result">
            {parsed.summary && <p className="ai-import__summary">{parsed.summary}</p>}
            {parsed.workouts.map((workout, i) => (
              <div className="ai-import__card" key={workout.title + i}>
                <strong>{workout.title}</strong>
                <ul>
                  {workout.items.map((item) => {
                    const ex = exerciseById.get(item.exerciseId)
                    return (
                      <li key={item.exerciseId}>
                        {ex ? exerciseName(ex) : item.exerciseId}
                        <small>{item.targetSets}×{formatReps(item)}</small>
                      </li>
                    )
                  })}
                </ul>
                <button type="button" onClick={() => applyParsed(workout)}>Подставить в форму</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
      <p className="picker__count">Найдено: {filtered.length}</p>
      <ul className="picker">
        {filtered.slice(0, visibleCount).map((ex) => {
          const added = form.items.some((item) => item.exerciseId === ex.id)
          return (
            <li key={ex.id} className={`picker__item${added ? ' is-added' : ''}`}>
              <span className="picker__media">
                {ex.imageUrl ? (
                  <ExerciseAnimation exercise={ex} alt={exerciseName(ex)} animate={false} />
                ) : (
                  <span className="picker__media-empty" aria-hidden="true" />
                )}
              </span>
              <div className="picker__info">
                <span className="picker__name">{exerciseName(ex)}</span>
                <small>{translateMuscle(ex.muscleGroup)} · {translateEquipment(ex.equipment)}</small>
              </div>
              <button type="button" onClick={() => addExercise(ex)} disabled={added}>
                {added ? 'Добавлено' : 'Добавить'}
              </button>
            </li>
          )
        })}
      </ul>
      {visibleCount < filtered.length && (
        <button type="button" className="picker__more" onClick={() => setVisibleCount(visibleCount + 40)}>
          Показать ещё ({filtered.length - visibleCount})
        </button>
      )}

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
