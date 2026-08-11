import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/firestore.js'
import { exerciseName } from '../../utils/translate.js'
import { formatReps, programItems } from '../../utils/programItems.js'
import { useAsyncAction } from '../../hooks/useAsyncAction.js'
import ExercisePicker from '../../components/ExercisePicker.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useConfirm } from '../../hooks/useConfirm.js'
import { planFromChat } from '../../api/ai.js'

const emptyForm = { id: null, title: '', level: '', duration: '', description: '', recommended: false, items: [] }

export default function AdminPrograms() {
  const [programs, setPrograms] = useState([])
  const [exercises, setExercises] = useState([])
  const [form, setForm] = useState(emptyForm)
  const { busy: saving, error, setError, run } = useAsyncAction()
  const { ask, confirmProps } = useConfirm()
  const [rawPlan, setRawPlan] = useState('')
  const { busy: parsing, error: parseError, run: runParse } = useAsyncAction()
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

  const exerciseById = useMemo(() => new Map(exercises.map((ex) => [ex.id, ex])), [exercises])
  const addedIds = useMemo(() => new Set(form.items.map((item) => item.exerciseId)), [form.items])

  // Разбор плана, вставленного текстом: модель раскладывает его на
  // упражнения библиотеки, а админ проверяет и правит перед сохранением.
  // Сразу в базу не пишем — программа видна всем, ошибку заметить важнее.
  async function handleParse() {
    setParsed(null)
    try {
      const result = await runParse(() =>
        planFromChat({ messages: [{ role: 'user', content: rawPlan }], exercises }),
      )
      setParsed(result)
    } catch {
      // ошибка уже показана ниже через parseError
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
      recommended: program.recommended || false,
      items: programItems(program),
    })
    // Список программ — внизу страницы, форма — вверху, а между ними
    // библиотека упражнений. Без прокрутки форма меняется незаметно,
    // и кажется, что кнопка ничего не делает.
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    if (form.items.length === 0) {
      setError('Добавьте хотя бы одно упражнение')
      return
    }
    try {
      await run(() => (form.id ? api.updateProgram(form) : api.createProgram(form)))
      setForm(emptyForm)
      load()
    } catch {
      // ошибка уже показана ниже через error
    }
  }

  async function handleDelete(id, title) {
    const confirmed = await ask({
      title: 'Удалить программу?',
      message: `«${title}» исчезнет из каталога у всех пользователей. Тренировки, начатые из неё, останутся.`,
    })
    if (!confirmed) return
    try {
      await run(() => api.deleteProgram({ id }))
      load()
    } catch {
      // ошибка уже показана ниже через error
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

        {parseError && <p className="error">{parseError}</p>}

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
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.recommended}
            onChange={(e) => setForm({ ...form, recommended: e.target.checked })}
          />
          Советуем (бейдж в каталоге программ)
        </label>

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
                    aria-label={`Подходы: ${ex ? exerciseName(ex) : item.exerciseId}`}
                  />
                  ×
                  <input
                    type="number"
                    min="1"
                    className="number-input"
                    value={item.targetReps}
                    onChange={(e) => updateItem(item.exerciseId, 'targetReps', Number(e.target.value))}
                    title="Повторы"
                    aria-label={`Повторы: ${ex ? exerciseName(ex) : item.exerciseId}`}
                  />
                  <button type="button" className="is-danger" onClick={() => removeExercise(item.exerciseId)}>Убрать</button>
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

      <ExercisePicker exercises={exercises} addedIds={addedIds} onAdd={addExercise} />

      <h3>Все программы</h3>
      <ul className="admin-list">
        {programs.map((p) => (
          <li key={p.id}>
            <span>
              {p.title} <small>({p.level})</small>
              {p.recommended && <span className="badge-recommended">Советуем</span>}
            </span>
            <span className="admin-list__actions">
              <button type="button" onClick={() => startEdit(p)}>Изменить</button>
              <button type="button" className="is-danger" onClick={() => handleDelete(p.id, p.title)}>Удалить</button>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog {...confirmProps} />
    </section>
  )
}
