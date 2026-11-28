import { useCallback, useRef, useState } from 'react'

// window.confirm подкупал одним: он возвращает ответ прямо в месте вызова,
// и обработчик читается сверху вниз. Свой диалог обычно ломает этот
// порядок на пару колбэков, поэтому прячем его за промисом — вызов
// остаётся однострочным:
//
//   if (!(await ask({ title: 'Удалить?' }))) return
//
// Промис резолвится, когда человек нажал кнопку или закрыл окно по Esc.
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)
  const resolveRef = useRef(null)

  const ask = useCallback((options) => {
    setRequest(options)
    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((answer) => {
    setRequest(null)
    setBusy(false)
    resolveRef.current?.(answer)
    resolveRef.current = null
  }, [])

  return {
    ask,
    // Пока выполняется само действие, диалог остаётся на экране с
    // заблокированными кнопками: закрыть его сразу — значит показать
    // человеку прежний список так, будто ничего не произошло.
    setBusy,
    confirmProps: {
      open: Boolean(request),
      busy,
      ...(request || {}),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      // Esc — это «передумал», а не выбор второй кнопки. Для «Удалить?/Отмена»
      // разницы нет (null тоже ложно), но когда обе кнопки что-то делают,
      // закрытие окна не должно молча выполнять одну из них.
      onDismiss: () => settle(null),
    },
  }
}
