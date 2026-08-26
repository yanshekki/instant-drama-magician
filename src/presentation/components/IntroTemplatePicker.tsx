import { useTranslation } from 'react-i18next'
import {
  INTRO_TEMPLATE_GROUPS,
  introTemplateLabelKey,
  isIntroVideoTemplateId,
  type IntroVideoTemplateId
} from '../../domain/introVideoTemplates'

export function IntroTemplatePicker({
  value,
  onChange,
  disabled,
  hideLabel
}: {
  value: IntroVideoTemplateId
  onChange: (id: IntroVideoTemplateId) => void
  disabled?: boolean
  hideLabel?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="min-w-0">
      {hideLabel ? null : (
        <p className="mb-1 text-[11px] font-medium text-ink-400">
          {t('introTemplates.label')}
        </p>
      )}
      <select
        className="w-full rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-[12px] text-ink-100 disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        disabled={disabled}
        aria-label={t('introTemplates.label')}
        onChange={(e) => {
          const next = e.target.value
          if (isIntroVideoTemplateId(next)) onChange(next)
        }}
      >
        {INTRO_TEMPLATE_GROUPS.map((group) => (
          <optgroup
            key={group.id}
            label={t(`introTemplates.group.${group.id}`)}
          >
            {group.ids.map((id) => (
              <option key={id} value={id}>
                {t(introTemplateLabelKey(id))}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
