import type { PrismaClient } from '../../types/prisma'

/**
 * Seeds a minimal demo story so first-run users can try the full path.
 * Assets are global library rows, linked to the story via M2M joins.
 * Theme is intentionally NEUTRAL (not rain-night) so it does not leak into
 * unrelated character invent defaults.
 */
export class DemoSeedService {
  constructor(private readonly prisma: PrismaClient) {}

  async seed(locale: 'zh-HK' | 'en' = 'zh-HK'): Promise<{ storyId: string; title: string }> {
    const zh = locale === 'zh-HK'
    const title = zh ? 'Demo：校巴最後一站' : 'Demo: Last Stop on the School Bus'

    const story = await this.prisma.story.create({
      data: {
        title,
        styleNote: zh
          ? '午後金光寫實風格，溫暖色調，手持輕微晃動，電影感。'
          : 'Afternoon gold-light realism; warm grade; slight handheld; cinematic.'
      }
    })

    const charA = await this.prisma.character.create({
      data: {
        name: zh ? '阿明' : 'Ming',
        description: zh
          ? '二十多歲，剛下班的辦公室助理，外表倔強，心裡仍掛念舊人。'
          : 'An office assistant in his twenties—stubborn outside, still thinking of someone.',
        soulMdPath: null,
        refImagePath: null
      }
    })
    const charB = await this.prisma.character.create({
      data: {
        name: zh ? '小悠' : 'Yau',
        description: zh
          ? '獨立書店店員，安靜、觀察力強，抱著一本舊書。'
          : 'A quiet bookstore clerk with an old paperback and sharp eyes.',
        soulMdPath: null,
        refImagePath: null
      }
    })

    const scene1 = await this.prisma.scene.create({
      data: {
        description: zh
          ? '午後巴士站簷篷下，陽光斜切，行人稀少。'
          : 'Under a bus-stop awning in the afternoon; slanted sun; few pedestrians.',
        script: zh
          ? '阿明放下公事包，望向尾班車方向。'
          : 'Ming sets down his bag and looks toward the last bus.',
        status: 'PENDING',
        title: zh ? '巴士站簷篷' : 'Bus stop awning'
      }
    })
    const scene2 = await this.prisma.scene.create({
      data: {
        description: zh
          ? '兩人在書店門口對望，玻璃門映出街景。'
          : 'They face each other at the bookstore door; glass reflects the street.',
        script: zh
          ? '小悠輕聲說：你仲記得呢條路。'
          : 'Yau softly: You still remember this street.',
        status: 'PENDING',
        title: zh ? '書店門口' : 'Bookstore door'
      }
    })

    const prop = await this.prisma.prop.create({
      data: {
        name: zh ? '舊平裝書' : 'Old paperback',
        description: zh
          ? '封面微捲，書脊有摺痕的平裝書。'
          : 'A paperback with a slightly curled cover and a creased spine.'
      }
    })

    await this.prisma.storyCharacter.createMany({
      data: [
        { storyId: story.id, characterId: charA.id, sortOrder: 0 },
        { storyId: story.id, characterId: charB.id, sortOrder: 1 }
      ]
    })
    await this.prisma.storyScene.createMany({
      data: [
        {
          storyId: story.id,
          sceneId: scene1.id,
          sceneNumber: 1,
          sortOrder: 0
        },
        {
          storyId: story.id,
          sceneId: scene2.id,
          sceneNumber: 2,
          sortOrder: 1
        }
      ]
    })
    await this.prisma.storyProp.create({
      data: { storyId: story.id, propId: prop.id, sortOrder: 0 }
    })

    const { commitBeatScriptEdit } = await import('../../domain/beatContent')
    const beat1Script = zh
      ? [
          '【心情】疲倦、戒備',
          '【氣氛】午後簷篷；斜陽',
          '【鏡頭】中景，跟手到公事包',
          '【聲效】遠方車聲、鞋底擦地',
          '【動作｜阿明】放下公事包，望向尾班車方向，深呼吸',
          '【表情｜阿明】眉心微緊，目光游移',
          '【對白｜阿明｜低聲】……又錯過一班。',
          '【對白｜阿明｜自語】（停半拍）……你仲喺附近？'
        ].join('\n')
      : [
          '[MOOD] weary, guarded',
          '[ATMO] afternoon awning; slanted sun',
          '[CAMERA] medium, follow hand to bag',
          '[SFX] distant traffic, shoe scrape',
          '[ACTION|Ming] sets bag down, looks toward the last bus, breathes',
          '[EXPR|Ming] slight furrow, eyes searching',
          '[DIALOGUE|Ming|low] …Missed another one.',
          '[DIALOGUE|Ming|aside] (beat) …Are you still nearby?'
        ].join('\n')
    const beat2Script = zh
      ? [
          '【心情】克制、心軟',
          '【氣氛】書店門口；玻璃反光',
          '【鏡頭】過肩，推近臉',
          '【動作｜小悠】抱書半步靠近，指尖摩書脊',
          '【表情｜小悠】安靜，觀察力強',
          '【對白｜小悠｜輕聲】你仲記得呢條路。',
          '【對白｜小悠】……對我嚟講，都係。'
        ].join('\n')
      : [
          '[MOOD] restrained, softening',
          '[ATMO] bookstore door; glass reflections',
          '[CAMERA] OTS, push to face',
          '[ACTION|Yau] steps closer with the book; thumb on the spine',
          '[EXPR|Yau] quiet, sharp eyes',
          '[DIALOGUE|Yau|soft] You still remember this street.',
          '[DIALOGUE|Yau] …So do I.'
        ].join('\n')
    const b1 = commitBeatScriptEdit(beat1Script, zh ? 'zh-HK' : 'en')
    const b2 = commitBeatScriptEdit(beat2Script, zh ? 'zh-HK' : 'en')
    await this.prisma.timelineEntry.createMany({
      data: [
        {
          storyId: story.id,
          startTime: 0,
          endTime: 8,
          order: 0,
          characterId: charA.id,
          sceneId: scene1.id,
          propId: null,
          dialogue: b1.dialogue ?? beat1Script,
          beatContentJson: b1.beatContentJson,
          mediaStatus: 'EMPTY'
        },
        {
          storyId: story.id,
          startTime: 8,
          endTime: 16,
          order: 1,
          characterId: charB.id,
          sceneId: scene2.id,
          propId: prop.id,
          dialogue: b2.dialogue ?? beat2Script,
          beatContentJson: b2.beatContentJson,
          mediaStatus: 'EMPTY'
        }
      ]
    })

    return { storyId: story.id, title: story.title }
  }
}
