import {
  compareAxesForFamily,
  recipeStarOn,
  type PromptTemplateFamily,
  type PromptTemplateId,
  type RecipeStar
} from '../../domain/promptTemplates'

function StarRow({
  label,
  value
}: {
  label: string
  value: RecipeStar
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${label} ${value}／5`}
    >
      <span className="w-[4.5rem] shrink-0 truncate text-[11px] text-ink-400">
        {label}
      </span>
      <span className="flex gap-0.5 text-sm leading-none tracking-tight" aria-hidden>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <span
            key={n}
            className={n <= value ? 'text-amber-400' : 'text-ink-300/35'}
          >
            ★
          </span>
        ))}
      </span>
    </div>
  )
}

export function RecipeCompareStars({
  id,
  family,
  labelFor
}: {
  id: PromptTemplateId
  family: PromptTemplateFamily
  labelFor: (axis: string) => string
}): JSX.Element {
  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      {compareAxesForFamily(family).map((axis) => (
        <StarRow
          key={axis}
          label={labelFor(axis)}
          value={recipeStarOn(id, axis)}
        />
      ))}
    </div>
  )
}
