import type { PrismaClient } from '../../types/prisma'

/**
 * Seeds a minimal demo story so first-run users can try the full path.
 */
export class DemoSeedService {
  constructor(private readonly prisma: PrismaClient) {}

  async seed(locale: 'zh-HK' | 'en' = 'zh-HK'): Promise<{ storyId: string; title: string }> {
    const zh = locale === 'zh-HK'
    const title = zh ? 'Demo：雨夜重逢' : 'Demo: Reunion in the Rain'

    const story = await this.prisma.story.create({
      data: {
        title,
        styleNote: zh
          ? '香港雨夜霓虹寫實風格，冷暖對比，手持輕微晃動，電影感。'
          : 'Hong Kong rainy-night neon realism; cool/warm contrast; slight handheld; cinematic.'
      }
    })

    const charA = await this.prisma.character.create({
      data: {
        storyId: story.id,
        name: zh ? '阿明' : 'Ming',
        description: zh
          ? '二十多歲，外賣騎手，外表倔強，心裡仍掛念舊人。'
          : 'A delivery rider in his twenties—stubborn outside, still thinking of someone.',
        soulMdPath: null,
        refImagePath: null
      }
    })
    const charB = await this.prisma.character.create({
      data: {
        storyId: story.id,
        name: zh ? '小雨' : 'Yu',
        description: zh
          ? '獨立書店店員，安靜、觀察力強，撐著透明雨傘。'
          : 'A quiet bookstore clerk with a clear umbrella and sharp eyes.',
        soulMdPath: null,
        refImagePath: null
      }
    })

    const scene1 = await this.prisma.scene.create({
      data: {
        storyId: story.id,
        sceneNumber: 1,
        description: zh
          ? '夜晚便利店簷篷下，霓虹燈倒映在積水。'
          : 'Under a convenience-store awning at night; neon in puddles.',
        script: zh
          ? '阿明停好電單車，甩開頭盔上的雨水。'
          : 'Ming parks the scooter and shakes rain off his helmet.',
        status: 'PENDING'
      }
    })
    const scene2 = await this.prisma.scene.create({
      data: {
        storyId: story.id,
        sceneNumber: 2,
        description: zh
          ? '兩人隔着一把透明雨傘對望，車燈掃過。'
          : 'They face each other under a clear umbrella; headlights sweep past.',
        script: zh
          ? '小雨輕聲說：你仲記得呢條路。'
          : 'Yu softly: You still remember this street.',
        status: 'PENDING'
      }
    })

    await this.prisma.prop.create({
      data: {
        storyId: story.id,
        name: zh ? '透明雨傘' : 'Clear umbrella',
        description: zh
          ? '普通透明長傘，把柄有輕微磨損。'
          : 'A plain clear umbrella with a slightly worn handle.'
      }
    })

    await this.prisma.timelineEntry.createMany({
      data: [
        {
          storyId: story.id,
          startTime: 0,
          endTime: 6,
          order: 0,
          characterId: charA.id,
          sceneId: scene1.id,
          propId: null,
          dialogue: zh ? '又係落雨……' : 'Raining again…',
          mediaStatus: 'EMPTY'
        },
        {
          storyId: story.id,
          startTime: 6,
          endTime: 12,
          order: 1,
          characterId: charB.id,
          sceneId: scene2.id,
          propId: null,
          dialogue: zh ? '你仲記得呢條路。' : 'You still remember this street.',
          mediaStatus: 'EMPTY'
        }
      ]
    })

    return { storyId: story.id, title: story.title }
  }
}
