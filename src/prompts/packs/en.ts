import type { PromptPack } from '../types'

const must = '[MUST]'
const mustNot = '[MUST NOT]'

export const enPromptPack: PromptPack = {
  id: 'en',
  languageName: 'English',
  tags: { must, mustNot },
  outputLock: [
    'Write EVERY user-visible string value (hardRules, descriptions, style notes, beat scripts, and the final image/video prompt body) in English.',
    'Do not mix languages. Do not translate proper names the user already typed.',
    `Prefix hard-rule lines with ${must} and ${mustNot} only.`,
    'JSON object keys stay in English.'
  ].join(' '),
  imagePolishDirective: `Produce an executable single-image director/technical prompt entirely in English. Put HARD RULES at the end if present, using only ${must} / ${mustNot}.`,
  videoPolishDirective: `Return ONE improved director prompt only, written entirely in English. Apply the improvement; keep IDENTITY/SPACE/OBJECT locks and HARD RULES (${must} / ${mustNot}).`,
  hardRulesInstruction: [
    'hardRules: REQUIRED non-empty string (never omit the key, never use null/array).',
    'Write 3–8 short lines mixing MUST and MUST-NOT for image & video gen of THIS asset only.',
    'Name the subject in each line when useful (e.g. "Character Maya: exactly two hands") so timeline merge can attribute rules to the correct object.',
    'Focus on common AI failures: extra limbs, wrong anatomy counts, unrelated objects (wires, logos), watermarks, third faces, wrong species.',
    `Format example: "${must} Character: exactly two hands, five fingers\\n${mustNot} extra limbs; watermarks; third face".`,
    'Do NOT pad with vague quality words (no "high quality", "masterpiece", "4k" alone).'
  ].join(' '),
  hardRulesFallback: {
    story: `${must} readable silhouette; coherent lighting\n${mustNot} watermarks; UI chrome; unreadable text captions; extra limbs on humans`,
    character: `${must} exactly two hands, two arms, two legs (unless non-human design)\n${mustNot} extra limbs; third face; watermarks; brand logos`,
    scene: `${must} empty-set location identity; consistent architecture\n${mustNot} new hero faces; watermarks; random props that break the location`,
    prop: `${must} single clear prop identity; clean silhouette\n${mustNot} unrelated wires/cables; extra objects; watermarks; celebrity faces`,
    action: `${must} same identity across all panels; readable motion beats\n${mustNot} extra limbs; panel count wrong; watermarks; title replacing a panel`,
    costume: `${must} full readable outer costume; correct silhouette on body\n${mustNot} ghost old outfit; fused limbs; watermarks; brand logos`
  }
}
