import { useState } from 'react'
import { findAlternatives } from '../utils/alternatives.js'
import { exerciseName, translateEquipment } from '../utils/translate.js'

// Замена упражнения прямо на странице тренировки. Открывается по кнопке и
// показывает аналоги той же группы мышц — подробнее о правилах подбора см.
// utils/alternatives.js.

export default function ExerciseSwap({ origin, catalogue, equipment, onSwap, busy }) {
  const [open, setOpen] = useState(false)

  if (!origin) return null

  const options = open ? findAlternatives(origin, catalogue, { equipment }) : []

  return (
    <div className="swap">
      <button type="button" className="swap__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Не менять' : 'Заменить'}
      </button>

      {open && (
        <div className="swap__panel">
          {options.length === 0 ? (
            <p className="swap__empty">
              В библиотеке нет другого упражнения на эту же группу мышц
              {equipment?.length ? ' с вашим инвентарём' : ''}.
            </p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="swap__option"
                disabled={busy}
                onClick={() => {
                  onSwap(option)
                  setOpen(false)
                }}
              >
                <strong>{exerciseName(option)}</strong>
                <span>
                  {option.reason}
                  {option.equipment && ` · ${translateEquipment(option.equipment)}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
