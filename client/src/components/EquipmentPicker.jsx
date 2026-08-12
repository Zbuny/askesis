import { translateEquipment } from '../utils/translate.js'
import { EQUIPMENT_PRESETS, activePreset, presetEquipment } from '../utils/equipmentPresets.js'

// Выбор инвентаря: сверху наборы, ниже — те же галочки поштучно.
// Один компонент на онбординг и на мастер ИИ, чтобы вопрос выглядел и
// работал одинаково в обоих местах.

export default function EquipmentPicker({ available, selected, onChange }) {
  const current = activePreset(selected, available)

  if (available.length === 0) return <p>Загружаем библиотеку...</p>

  return (
    <div className="equipment">
      <div className="equipment__presets">
        {EQUIPMENT_PRESETS.map((preset) => {
          const items = presetEquipment(preset, available)
          if (items.length === 0) return null
          const isActive = current?.key === preset.key
          return (
            <button
              key={preset.key}
              type="button"
              className={isActive ? 'equipment__preset is-selected' : 'equipment__preset'}
              aria-pressed={isActive}
              // Повторное нажатие снимает набор целиком: иначе, чтобы уйти
              // от «зала» к своему набору, пришлось бы снимать одиннадцать
              // галочек вручную.
              onClick={() => onChange(isActive ? [] : items)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.hint}</span>
            </button>
          )
        })}
      </div>

      <span className="equipment__divider">или отметьте по отдельности</span>

      <div className="choice-grid">
        {available.map((value) => (
          <button
            key={value}
            type="button"
            className={selected.includes(value) ? 'choice is-selected' : 'choice'}
            onClick={() =>
              onChange(
                selected.includes(value)
                  ? selected.filter((item) => item !== value)
                  : [...selected, value],
              )
            }
          >
            {translateEquipment(value)}
          </button>
        ))}
      </div>
    </div>
  )
}
