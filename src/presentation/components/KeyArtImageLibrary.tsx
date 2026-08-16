import { useTranslation } from 'react-i18next'
import { Button } from './ui'
import { LocalMediaImage } from './LocalMediaImage'
import type { KeyArtShotImage } from '../../domain/keyArtShotImages'
import { getKeyArtMakeMethod } from '../../domain/keyArtMakeMethods'

export function KeyArtImageLibrary({
  images,
  primaryPath,
  canGenerate,
  generateBusy,
  onGenerate,
  onSetPrimary,
  onDelete
}: {
  images: KeyArtShotImage[]
  primaryPath?: string | null
  canGenerate: boolean
  generateBusy?: boolean
  onGenerate: () => void
  onSetPrimary: (image: KeyArtShotImage) => void
  onDelete: (image: KeyArtShotImage, versionN: number) => void
}): JSX.Element {
  const { t } = useTranslation()
  const n = images.length
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">
            {t('keyArt.imageLibrary')}
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {n === 0
              ? t('keyArt.emptyImages')
              : t('keyArt.imageCount', { n })}
          </p>
        </div>
        <Button onClick={onGenerate} disabled={!canGenerate || generateBusy}>
          {n === 0 ? t('keyArt.generate') : t('keyArt.newVersion')}
        </Button>
      </div>
      {n === 0 ? (
        <button
          type="button"
          disabled={!canGenerate || generateBusy}
          onClick={onGenerate}
          className="flex min-h-[9rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/30 px-4 py-8 text-center text-sm text-ink-400"
        >
          {t('keyArt.generate')}
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, i) => {
            const versionN = n - i
            const isPrimary = Boolean(primaryPath && image.path === primaryPath)
            const method = getKeyArtMakeMethod(image.method)
            return (
              <article
                key={image.id}
                className={[
                  'overflow-hidden rounded-xl border bg-ink-950/70',
                  isPrimary
                    ? 'border-brand-400 ring-2 ring-brand-400/80'
                    : 'border-ink-800'
                ].join(' ')}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-ink-900">
                  <LocalMediaImage
                    filePath={image.path}
                    alt=""
                    variant="fill"
                    showActions={false}
                    className="h-full w-full object-cover"
                  />
                  {isPrimary ? (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                      {t('keyArt.isPrimary')}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-200">
                      {t(`keyArt.${method.titleKey}`)}
                    </span>
                    <span className="text-[11px] font-medium text-ink-300">
                      {t('keyArt.versionN', { n: versionN })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {isPrimary ? (
                      <Button
                        variant="secondary"
                        className="!h-9 !min-h-9 !px-2 !text-xs"
                        disabled
                      >
                        {t('keyArt.isPrimary')}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="!h-9 !min-h-9 !px-2 !text-xs"
                        onClick={() => onSetPrimary(image)}
                      >
                        {t('keyArt.setPrimary')}
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      className="!h-9 !min-h-9 !px-2 !text-xs"
                      onClick={() => onDelete(image, versionN)}
                    >
                      {t('keyArt.deleteVersion')}
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
