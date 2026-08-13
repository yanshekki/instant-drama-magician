import type { PromptPack } from '../types'

const must = '[OBLIGATORIO]'
const mustNot = '[PROHIBIDO]'

export const esPromptPack: PromptPack = {
  id: 'es',
  languageName: 'español',
  tags: { must, mustNot },
  outputLock: [
    'Escribe TODOS los textos visibles (hardRules, descripciones, biblia de estilo, guion de beats y el prompt final de imagen/vídeo) en español.',
    'No mezcles idiomas. No traduzcas los nombres propios que el usuario ya escribió.',
    `Prefija las líneas de reglas duras solo con ${must} y ${mustNot}.`,
    'Las claves JSON siguen en inglés.'
  ].join(' '),
  imagePolishDirective: `Redacta un prompt técnico/de dirección para UNA imagen, entero en español. Si hay HARD RULES, al final, solo con ${must} / ${mustNot}.`,
  noRefPolishDirective:
    'No hay stills de referencia adjuntos. Escribe solo a partir de los materiales de texto. No menciones el espacio de trabajo, Wikipedia, búsquedas en la web ni bloquear la identidad a imágenes adjuntas. No inventes bloqueos Ref#.',
  sexLockMale:
    'El sujeto es un hombre adulto (varón). Estructura ósea masculina, hombros más anchos, cara y cuerpo de hombre; no una mujer ni un default de belleza femenina.',
  sexLockFemale:
    'El sujeto es una mujer adulta. Estructura ósea y cuerpo femeninos; no un hombre.',
  sexForbidMale:
    'cara o cuerpo femeninos, pecho, default de belleza femenina, cambio de sexo, dibujar al hombre como mujer',
  sexForbidFemale:
    'cara o cuerpo masculinos, barba no pedida, dibujar a la mujer como hombre',
  videoPolishDirective: `Devuelve UN solo prompt de dirección mejorado, entero en español. Conserva bloqueos IDENTITY/SPACE/OBJECT y las reglas (${must} / ${mustNot}).`,
  hardRulesInstruction: [
    'hardRules: cadena NO vacía obligatoria (nunca omitas la clave, nunca null/array).',
    `Escribe 3–8 líneas cortas mezclando ${must} y ${mustNot} solo para imagen y vídeo de ESTE activo.`,
    'Nombra al sujeto cuando ayude (p. ej. «Personaje Maya: exactamente dos manos»).',
    'Céntrate en fallos típicos de IA: extremidades de más, recuentos anatómicos mal, objetos ajenos (cables, logos), marcas de agua, terceras caras, especie incorrecta.',
    `Ejemplo: "${must} Personaje: exactamente dos manos, cinco dedos\\n${mustNot} extremidades extra; marcas de agua; tercera cara".`,
    'No rellenes con palabras vacías de calidad («alta calidad», «obra maestra», «4k» solas).'
  ].join(' '),
  hardRulesFallback: {
    story: `${must} silueta legible; iluminación coherente\n${mustNot} marcas de agua; cromo de UI; subtítulos ilegibles; extremidades extra en humanos`,
    character: `${must} exactamente dos manos, dos brazos, dos piernas (salvo diseño no humano)\n${mustNot} extremidades extra; tercera cara; marcas de agua; logos de marca`,
    scene: `${must} identidad del lugar en plano vacío; arquitectura coherente\n${mustNot} caras nuevas de protagonistas; marcas de agua; atrezzo que rompa el lugar`,
    prop: `${must} un solo atrezzo claro; silueta limpia\n${mustNot} cables ajenos; objetos de más; marcas de agua; caras de famosos`,
    action: `${must} misma identidad en todos los paneles; beats de movimiento legibles\n${mustNot} extremidades extra; número de paneles mal; marcas de agua; título que sustituya un panel`,
    costume: `${must} vestuario exterior completo y legible; silueta correcta\n${mustNot} residuo del traje anterior; miembros fusionados; marcas de agua; logos de marca`
  }
}
