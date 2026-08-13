import type { PromptPack } from '../types'

const must = '【必須】'
const mustNot = '【禁止】'

export const jaPromptPack: PromptPack = {
  id: 'ja',
  languageName: '日本語',
  tags: { must, mustNot },
  outputLock: [
    'ユーザーに見える文字列（hardRules、説明、スタイル聖書、ビート脚本、最終的な画像／動画プロンプト本文）はすべて日本語で書く。',
    '言語を混ぜない。ユーザーが既に書いた固有名詞は翻訳しない。',
    `ハードルール行の接頭辞は ${must} と ${mustNot} のみ。`,
    'JSON のキー名は英語のまま。'
  ].join(''),
  imagePolishDirective: `実行可能な一枚絵の演出／技術プロンプトを、全文日本語で書く。HARD RULES があれば末尾に置き、タグは ${must}／${mustNot} のみ。`,
  videoPolishDirective: `改善後の演出プロンプトを一条だけ返す。全文日本語。IDENTITY／SPACE／OBJECT ロックと鉄則（${must}／${mustNot}）を残す。`,
  hardRulesInstruction: [
    'hardRules：必須の非空文字列（キー欠落・null／配列は不可）。',
    `${must} と ${mustNot} を混ぜた 3–8 行を、この資産の画像・動画生成だけに書く。`,
    '必要なら主体を名指しする（例：「キャラクター小雨：手がちょうど二本」）。',
    '重点：余剰肢体、解剖の数え間違い、無関係な物（電線、ロゴ）、透かし、第三者の顔、種の取り違え。',
    `書式例：「${must}キャラクター：手がちょうど二本、五指が揃う\\n${mustNot}第三の肢体；透かし；第三者の顔」。`,
    '「高品質」「傑作」「4k」だけの空疎な画質語で埋めない。'
  ].join(' '),
  hardRulesFallback: {
    story: `${must}シルエットが読める；光が一貫\\n${mustNot}透かし；UI枠；読めない字幕；人間の余剰肢体`,
    character: `${must}手がちょうど二本、腕二本、脚二本（非人間設定を除く）\\n${mustNot}余剰肢体；第三者の顔；透かし；ブランドロゴ`,
    scene: `${must}空撮の場所アイデンティティ；建築が一貫\\n${mustNot}新しい主役の顔；透かし；場所を壊す乱入小道具`,
    prop: `${must}単一ではっきりした小道具；輪郭がきれい\\n${mustNot}無関係な電線；余分な物体；透かし；有名人の顔`,
    action: `${must}全コマで同一人物；動作ビートが読める\\n${mustNot}余剰肢体；コマ数間違い；透かし；タイトルがコマを置き換える`,
    costume: `${must}外装の衣装が全部読める；体の輪郭が正しい\\n${mustNot}旧衣装の残像；肢体の融合；透かし；ブランドロゴ`
  }
}
