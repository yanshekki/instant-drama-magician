import type { PromptPack } from '../types'

const must = '[OBRIGATÓRIO]'
const mustNot = '[PROIBIDO]'

export const ptBrPromptPack: PromptPack = {
  id: 'pt-BR',
  languageName: 'português brasileiro',
  tags: { must, mustNot },
  outputLock: [
    'Escreva TODOS os textos visíveis (hardRules, descrições, bíblia de estilo, roteiro dos beats e o prompt final de imagem/vídeo) em português brasileiro.',
    'Não misture idiomas. Não traduza nomes próprios que o usuário já escreveu.',
    `Prefixe as linhas de regras rígidas apenas com ${must} e ${mustNot}.`,
    'As chaves JSON continuam em inglês.'
  ].join(' '),
  imagePolishDirective: `Produza um prompt técnico/de direção para UMA imagem, inteiro em português brasileiro. Se houver HARD RULES, no fim, só ${must} / ${mustNot}.`,
  noRefPolishDirective:
    'Não há stills de referência anexados. Escreva só a partir dos materiais de texto. Não mencione a área de trabalho, a Wikipédia, busca na web nem travar identidade em imagens anexadas. Não invente travas Ref#.',
  sexLockMale:
    'O sujeito é um homem adulto. Estrutura óssea masculina, ombros mais largos, rosto e corpo de homem; não uma mulher nem o padrão de beleza feminina.',
  sexLockFemale:
    'O sujeito é uma mulher adulta. Estrutura óssea e corpo femininos; não um homem.',
  sexForbidMale:
    'rosto ou corpo femininos, seios, padrão de beleza feminina, troca de sexo, desenhar o homem como mulher',
  sexForbidFemale:
    'rosto ou corpo masculinos, barba não pedida, desenhar a mulher como homem',
  videoPolishDirective: `Devolva UM único prompt de direção melhorado, inteiro em português brasileiro. Mantenha os bloqueios IDENTITY/SPACE/OBJECT e as regras (${must} / ${mustNot}).`,
  hardRulesInstruction: [
    'hardRules: string NÃO vazia obrigatória (nunca omita a chave, nunca null/array).',
    `Escreva 3–8 linhas curtas misturando ${must} e ${mustNot} só para imagem e vídeo DESTE ativo.`,
    'Nomeie o sujeito quando ajudar (ex.: «Personagem Maya: exatamente duas mãos»).',
    'Foque falhas comuns de IA: membros a mais, contagem anatômica errada, objetos alheios (fios, logos), marcas d’água, terceiro rosto, espécie errada.',
    `Exemplo: "${must} Personagem: exatamente duas mãos, cinco dedos\\n${mustNot} membros extras; marcas d’água; terceiro rosto".`,
    'Não preencha com palavras vazias de qualidade («alta qualidade», «obra-prima», «4k» sozinhas).'
  ].join(' '),
  hardRulesFallback: {
    story: `${must} silhueta legível; luz coerente\n${mustNot} marcas d’água; cromo de UI; legendas ilegíveis; membros extras em humanos`,
    character: `${must} exatamente duas mãos, dois braços, duas pernas (salvo design não humano)\n${mustNot} membros extras; terceiro rosto; marcas d’água; logos de marca`,
    scene: `${must} identidade do lugar em plano vazio; arquitetura coerente\n${mustNot} rostos novos de protagonistas; marcas d’água; objetos que quebrem o lugar`,
    prop: `${must} um único objeto claro; silhueta limpa\n${mustNot} fios alheios; objetos a mais; marcas d’água; rostos de famosos`,
    action: `${must} mesma identidade em todos os painéis; beats de movimento legíveis\n${mustNot} membros extras; número de painéis errado; marcas d’água; título no lugar de um painel`,
    costume: `${must} figurino externo completo e legível; silhueta correta\n${mustNot} residual do traje antigo; membros fundidos; marcas d’água; logos de marca`
  }
}
