# Plot focus payload (`suggestFromStory` + `segmentKeys`)

> Used by `characters:aiFill`, `scenes:aiFill`, `props:aiFill`, `actions:aiFill`, `costumes:aiFill`, and `characters:suggestWardrobe`.  
> 中文摘要見文末。

There is **no** dedicated plot-suggest channel. Pass flags on `*:aiFill`.

## Contract

| Field | Required | Meaning |
|-------|----------|---------|
| `suggestFromStory` | yes, to inject plot | Must be `true`. Without it, `storyId` alone does **not** inject plot. |
| `storyId` | when suggesting | Required if `suggestFromStory` is true |
| `segmentKeys` | no | `["chapter:<id>","beat:<id>",…]`. Omit or `[]` = **entire story** (chapter bodies first, then beats) |
| `segmentKey` | no | **Deprecated** singular. Prefer `segmentKeys` |
| `idea` / `existingDraft` | no | May be empty when suggesting from story |
| `promptTemplateId` | no | Desktop recipe picker; pass if the user picked one |

`scene:<id>` still resolves in the handler; the desktop picker no longer lists scenes. Unknown keys are ignored; if nothing matches, the handler falls back to the entire story.

Desktop **default-check** (beats that already bound the entity being filled) is **GUI-only**. CLI / agents must pass `segmentKeys` explicitly.

## Examples

```bash
# Whole story (chapters first)
instant-drama scenes ai-fill --args '[{
  "storyId":"S","suggestFromStory":true
}]' --json

# Selected chapters + beats
instant-drama characters ai-fill --args '[{
  "storyId":"S",
  "suggestFromStory":true,
  "segmentKeys":["chapter:C1","beat:B2"]
}]' --json

instant-drama characters suggest-wardrobe --args '[{
  "characterId":"CH","storyId":"S",
  "segmentKeys":["beat:B2"]
}]' --json
```

Discover live hints:

```bash
instant-drama channels describe scenes:aiFill --json
```

## Timeline multi-bind (related)

`timeline:create` / `timeline:update` accept arrays (clamped): `characterIds` max 4, `sceneIds` max 2, `propIds` max 4, `actionIds` max 4. First id is the primary / legacy FK.

```bash
instant-drama timeline create --args '[{
  "storyId":"S",
  "dialogue":"…",
  "characterIds":["CH1","CH2"],
  "sceneIds":["SC1"]
}]' --json
```

`stories:aiFillScript` can take `chapterIds` to split those chapter bodies into beats.

---

## 中文摘要

- 唔存在獨立「由劇情建議」channel；喺 `*:aiFill` payload 傳 `suggestFromStory` + `segmentKeys`。
- 空／唔傳 `segmentKeys` = 成個故事（先章節正文）。
- Key：`chapter:<id>`、`beat:<id>`。單數 `segmentKey` 已棄用。
- 桌面預勾只限 GUI；CLI 要自己傳 keys。
- 時間軸多綁上限：角色 4／場景 2／道具 4／動作 4。
