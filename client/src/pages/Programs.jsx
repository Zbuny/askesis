import { api } from '../api/firestore.js'
import { useAsyncData } from '../hooks/useAsyncData.js'
import ProgramCard from '../components/ProgramCard.jsx'
import { EmptyState, PageError, PageLoading } from '../components/PageState.jsx'

export default function Programs() {
  const { data: programs, loading, error, reload } = useAsyncData(api.listPrograms, [])

  if (loading) return <PageLoading label="Загружаем программы" />
  if (error) return <PageError title="Не получилось загрузить программы" message={error} onRetry={reload} backTo="/dashboard" />

  return (
    <section>
      <h2>Программы тренировок</h2>
      {programs.length === 0 && (
        <EmptyState
          title="Программ пока нет"
          text="Каталог ещё наполняется. Пока можно собрать тренировку самому или попросить ИИ-тренера."
        />
      )}
      <div className="program-grid">
        {programs.map((p) => (
          <ProgramCard key={p.id} program={p} />
        ))}
      </div>
    </section>
  )
}
