import {
  defaultTemplateId,
  resolvePromptTemplate,
  type PromptTemplateFamily,
  type PromptTemplateId
} from '../../domain/promptTemplates'

export const PROMPT_TEMPLATE_PREF_KEY = 'idm.promptTemplate.v1'

export type PromptTemplatePref = {
  last?: PromptTemplateId
  always?: boolean
}

export type PromptTemplatePrefStore = Partial<
  Record<PromptTemplateFamily, PromptTemplatePref>
>

export function readPromptTemplatePrefs(
  storage?: Pick<Storage, 'getItem'> | null
): PromptTemplatePrefStore {
  try {
    const raw = storage?.getItem(PROMPT_TEMPLATE_PREF_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PromptTemplatePrefStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writePromptTemplatePrefs(
  next: PromptTemplatePrefStore,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    storage?.setItem(PROMPT_TEMPLATE_PREF_KEY, JSON.stringify(next))
  } catch {
    /* quota */
  }
}

export function rememberedTemplate(
  family: PromptTemplateFamily,
  store?: PromptTemplatePrefStore
): { id: PromptTemplateId; always: boolean } {
  const slot = store?.[family]
  const id = resolvePromptTemplate(slot?.last, family)
  return { id, always: Boolean(slot?.always && slot.last) }
}

export function withRemembered(
  store: PromptTemplatePrefStore,
  family: PromptTemplateFamily,
  id: PromptTemplateId,
  always: boolean
): PromptTemplatePrefStore {
  return {
    ...store,
    [family]: { last: id, always }
  }
}

export function fallbackTemplate(family: PromptTemplateFamily): PromptTemplateId {
  return defaultTemplateId(family)
}

/** Clear remembered / always-use recipes so the picker asks again. */
export function clearPromptTemplatePrefs(
  storage?: Pick<Storage, 'removeItem'> | null
): void {
  try {
    storage?.removeItem(PROMPT_TEMPLATE_PREF_KEY)
  } catch {
    /* private mode */
  }
}

export function hasRememberedAlways(
  store?: PromptTemplatePrefStore
): boolean {
  if (!store) return false
  return Boolean(store.copy?.always || store.media?.always)
}
