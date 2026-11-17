import { useEffect, useState } from 'react'
import { canPromptInstall, isIos, isStandalone, onInstallAvailability, promptInstall } from '../utils/installPrompt.js'

// Где браузер умеет ставить сам (Chrome, Edge, Samsung) — одна кнопка. Где
// не умеет (Safari на iPhone) — короткая инструкция под конкретный телефон,
// а не обе сразу: человеку с айфоном меню «⋮» ни о чём не скажет.
export default function InstallApp() {
  const [available, setAvailable] = useState(canPromptInstall)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => onInstallAvailability(setAvailable), [])

  async function handleInstall() {
    const accepted = await promptInstall()
    if (accepted) setInstalled(true)
  }

  if (installed) {
    return <p className="install__done">Askesis уже стоит на этом устройстве.</p>
  }

  if (available) {
    return (
      <button type="button" className="button" onClick={handleInstall}>
        Установить Askesis
      </button>
    )
  }

  return (
    <ol className="install__steps">
      {isIos() ? (
        <>
          <li>Открой сайт в Safari</li>
          <li>Нажми «Поделиться» внизу экрана</li>
          <li>Выбери «На экран Домой»</li>
        </>
      ) : (
        <>
          <li>Открой сайт в Chrome на телефоне</li>
          <li>Нажми меню ⋮ в правом верхнем углу</li>
          <li>Выбери «Установить приложение»</li>
        </>
      )}
    </ol>
  )
}
