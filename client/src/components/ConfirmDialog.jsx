import { useEffect, useRef } from 'react'

// Замена window.confirm. Нативное окно не поддаётся оформлению, блокирует
// весь поток на время показа и в мобильных браузерах выглядит как
// предупреждение сайта-мошенника — на важном «удалить навсегда» это ровно
// то место, где человек должен доверять интерфейсу.
//
// Диалог строится на <dialog>: браузер сам берёт на себя модальность,
// фокус-ловушку, закрытие по Esc и затемнение фона.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // Esc и клик по «крестику» браузера закрывают <dialog> мимо наших
    // кнопок — состояние снаружи должно об этом узнать.
    const handleCancel = (event) => {
      event.preventDefault()
      if (!busy) onCancel?.()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [busy, onCancel])

  return (
    <dialog className="confirm" ref={ref} aria-labelledby="confirm-title">
      <h3 id="confirm-title">{title}</h3>
      {message && <p>{message}</p>}
      <div className="confirm__actions">
        {/* Фокус — на отмене: диалог показывают перед необратимым действием,
            и случайный Enter не должен ничего удалять. */}
        <button type="button" onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'is-danger' : ''}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Удаляем...' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
