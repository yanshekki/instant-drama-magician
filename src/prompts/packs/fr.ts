import type { PromptPack } from '../types'

const must = '[OBLIGATOIRE]'
const mustNot = '[INTERDIT]'

export const frPromptPack: PromptPack = {
  id: 'fr',
  languageName: 'français',
  tags: { must, mustNot },
  outputLock: [
    'Rédige TOUTES les chaînes visibles (hardRules, descriptions, bible de style, script des beats et le prompt image/vidéo final) en français.',
    'Ne mélange pas les langues. Ne traduis pas les noms propres déjà saisis par l’utilisateur.',
    `Préfixe les lignes de règles uniquement avec ${must} et ${mustNot}.`,
    'Les clés JSON restent en anglais.'
  ].join(' '),
  imagePolishDirective: `Produis un prompt technique/de mise en scène pour UNE image, entièrement en français. Si HARD RULES : à la fin, uniquement ${must} / ${mustNot}.`,
  noRefPolishDirective:
    "Aucune image de référence n'est jointe. Rédige uniquement à partir des matériaux textuels. Ne mentionne pas l'espace de travail, Wikipédia, une recherche web, ni un verrouillage d'identité sur des images jointes. N'invente pas de verrous Ref#.",
  videoPolishDirective: `Renvoie UN seul prompt de mise en scène amélioré, entièrement en français. Conserve les verrous IDENTITY/SPACE/OBJECT et les règles (${must} / ${mustNot}).`,
  hardRulesInstruction: [
    'hardRules : chaîne NON vide obligatoire (jamais omettre la clé, jamais null/tableau).',
    `Écris 3–8 lignes courtes mêlant ${must} et ${mustNot} uniquement pour l’image et la vidéo de CET actif.`,
    'Nomme le sujet si utile (ex. « Personnage Maya : exactement deux mains »).',
    'Cible les échecs IA courants : membres en trop, mauvais décompte anatomique, objets hors sujet (fils, logos), filigranes, troisième visage, mauvaise espèce.',
    `Exemple : "${must} Personnage : exactement deux mains, cinq doigts\\n${mustNot} membres supplémentaires ; filigranes ; troisième visage".`,
    'Ne remplis pas avec des mots de qualité vides (« haute qualité », « chef-d’œuvre », « 4k » seuls).'
  ].join(' '),
  hardRulesFallback: {
    story: `${must} silhouette lisible ; lumière cohérente\n${mustNot} filigranes ; chrome d’UI ; sous-titres illisibles ; membres en trop sur les humains`,
    character: `${must} exactement deux mains, deux bras, deux jambes (sauf design non humain)\n${mustNot} membres en trop ; troisième visage ; filigranes ; logos de marque`,
    scene: `${must} identité du lieu en plan vide ; architecture cohérente\n${mustNot} nouveaux visages de héros ; filigranes ; accessoires qui cassent le lieu`,
    prop: `${must} un seul accessoire clair ; silhouette nette\n${mustNot} câbles hors sujet ; objets en trop ; filigranes ; visages de célébrités`,
    action: `${must} même identité sur tous les panneaux ; beats de mouvement lisibles\n${mustNot} membres en trop ; mauvais nombre de cases ; filigranes ; titre qui remplace une case`,
    costume: `${must} costume extérieur entier et lisible ; silhouette correcte\n${mustNot} fantôme de l’ancien habit ; membres fusionnés ; filigranes ; logos de marque`
  }
}
