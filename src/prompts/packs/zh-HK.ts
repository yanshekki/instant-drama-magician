import type { PromptPack } from '../types'

const must = '【必須】'
const mustNot = '【禁止】'

export const zhHkPromptPack: PromptPack = {
  id: 'zh-HK',
  languageName: '繁體中文',
  tags: { must, mustNot },
  outputLock: [
    '所有用戶可見字串（hardRules、描述、風格聖經、段落腳本、以及最終出圖／出片提示詞 正文）必須用繁體中文。',
    '不要中英夾雜。用戶已寫的專有名詞不要翻譯走。',
    `鐵則行只可用 ${must} 與 ${mustNot} 作前綴。`,
    'JSON 物件鍵名維持英文。'
  ].join(''),
  imagePolishDirective: `產出可執行的單圖技術／導演提示詞，全文使用繁體中文。若有生成鐵則置於文末，標籤只用 ${must}／${mustNot}。`,
  noRefPolishDirective:
    '沒有附上參考靜圖。只根據文字材料撰寫。不要提及工作區、維基百科、上網搜尋，或把身份鎖定到附圖。不要虛構 Ref# 鎖定。',
  sexLockMale:
    '此主體是成年男性。男性骨骼、肩寬與男性臉身；不是女人、不是中性網紅臉、不是女扮男裝。低髻、鵝蛋臉、白皙或偏窄身材都不得改成女性。',
  sexLockFemale:
    '此主體是成年女性。女性骨骼與身形；不是男人、不是男性臉安在女身上。',
  sexForbidMale:
    '女性臉或身材、豐胸、雌性比例、把男性畫成女人、女裝美男預設',
  sexForbidFemale:
    '男性臉或身材、無故鬍鬚、把女性畫成男人',
  videoPolishDirective: `只回傳一條改進後的導演提示詞，全文使用繁體中文。套用改進；保留 身份／空間／物件 鎖定與鐵則（${must}／${mustNot}）。`,
  hardRulesInstruction: [
    'hardRules：必填非空字串（不可缺鍵、不可 null／陣列）。',
    `用 3–8 短句寫${must}與${mustNot}，只針對本資產出圖／出片常見幻覺。`,
    '句中宜點名主體（例：「角色小雨：恰好兩隻手」），方便時間軸合併時對應到正確物件。',
    '重點：多餘肢體、解剖數量錯誤、無關雜物（電線、標誌）、水印、第三人臉、物種錯誤。',
    `格式例：「${must}角色：恰好兩隻手、五指完整\\n${mustNot}第三肢體；水印；第三人臉」。`,
    '禁止用空泛畫質詞充數（不可只寫 high quality／傑作／4k）。'
  ].join(' '),
  hardRulesFallback: {
    story: `${must}剪影可讀；光線連貫\n${mustNot}水印；UI 邊框；難讀字幕；人類多餘肢體`,
    character: `${must}恰好兩隻手、兩臂、兩腿（非人設定除外）\n${mustNot}多餘肢體；第三人臉；水印；品牌標誌`,
    scene: `${must}空鏡場地身份；建築一致\n${mustNot}新增主角臉；水印；破壞場地的亂入道具`,
    prop: `${must}單一清晰道具身份；輪廓乾淨\n${mustNot}無關電線／纜線；多餘雜物；水印；名人臉`,
    action: `${must}各格身份一致；動作節拍可讀\n${mustNot}多餘肢體；格數錯誤；水印；標題取代分鏡格`,
    costume: `${must}外層戲服完整可讀；輪廓正確\n${mustNot}舊裝殘影；肢體融合；水印；品牌標誌`
  }
}
