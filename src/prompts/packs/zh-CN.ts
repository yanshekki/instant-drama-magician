import type { PromptPack } from '../types'

const must = '【必须】'
const mustNot = '【禁止】'

/** Simplified-Chinese wording; same structure as zh-HK. */
export const zhCnPromptPack: PromptPack = {
  id: 'zh-CN',
  languageName: '简体中文',
  tags: { must, mustNot },
  outputLock: [
    '所有用户可见字符串（hardRules、描述、风格圣经、段落剧本、以及最终出图／出片 prompt 正文）必须用简体中文。',
    '不要中英夹杂。用户已写的专有名词不要翻译走。',
    `铁则行只可用 ${must} 与 ${mustNot} 作前缀。`,
    'JSON 对象键名维持英文。'
  ].join(''),
  imagePolishDirective: `产出可执行的单图技术／导演提示词，全文使用简体中文。若有生成铁则置于文末，标签只用 ${must}／${mustNot}。`,
  noRefPolishDirective:
    '没有附上参考静图。只根据文字材料撰写。不要提及工作区、维基百科、上网搜索，或把身份锁定到附图。不要虚构 Ref# 锁定。',
  sexLockMale:
    '此主体是成年男性。男性骨骼、肩宽与男性脸身；不是女人、不是中性网红脸、不是女扮男装。低髻、鹅蛋脸、白皙或偏窄身材都不得改成女性。',
  sexLockFemale:
    '此主体是成年女性。女性骨骼与身形；不是男人、不是男性脸安在女身上。',
  sexForbidMale:
    '女性脸或身材、丰胸、雌性比例、把男性画成女人、女装美男预设',
  sexForbidFemale:
    '男性脸或身材、无故胡须、把女性画成男人',
  videoPolishDirective: `只回传一条改进后的导演提示词，全文使用简体中文。套用改进；保留 IDENTITY／SPACE／OBJECT 锁定与铁则（${must}／${mustNot}）。`,
  hardRulesInstruction: [
    'hardRules：必填非空字符串（不可缺键、不可 null／数组）。',
    `用 3–8 短句写${must}与${mustNot}，只针对本资产出图／出片常见幻觉。`,
    '句中宜点名主体（例：「角色小雨：恰好两只手」），方便时间轴合并时对应到正确物件。',
    '重点：多余肢体、解剖数量错误、无关杂物（电线、Logo）、水印、第三人脸、物种错误。',
    `格式例：「${must}角色：恰好两只手、五指完整\\n${mustNot}第三肢体；水印；第三人脸」。`,
    '禁止用空泛画质词充数（不可只写 high quality／杰作／4k）。'
  ].join(' '),
  hardRulesFallback: {
    story: `${must}剪影可读；光线连贯\n${mustNot}水印；UI 边框；难读字幕；人类多余肢体`,
    character: `${must}恰好两只手、两臂、两腿（非人设定除外）\n${mustNot}多余肢体；第三人脸；水印；品牌 Logo`,
    scene: `${must}空镜场地身份；建筑一致\n${mustNot}新增主角脸；水印；破坏场地的乱入道具`,
    prop: `${must}单一清晰道具身份；轮廓干净\n${mustNot}无关电线／缆线；多余杂物；水印；名人脸`,
    action: `${must}各格身份一致；动作节拍可读\n${mustNot}多余肢体；格数错误；水印；标题取代分镜格`,
    costume: `${must}外层戏服完整可读；轮廓正确\n${mustNot}旧装残影；肢体融合；水印；品牌 Logo`
  }
}
