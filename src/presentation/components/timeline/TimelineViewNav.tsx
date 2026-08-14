import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { writeTimelinePagePref } from '../../lib/timelinePagePref'

const TRACK = '/timeline'
const BOARD = '/timeline-v2'

export function isTimelinePath(pathname: string): boolean {
  return pathname === TRACK || pathname === BOARD
}

const chipBase =
  'inline-flex h-8 min-h-8 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors'

function chipClass(active: boolean): string {
  return [
    chipBase,
    active
      ? 'bg-brand-800/80 text-brand-50 ring-1 ring-brand-400/50'
      : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
  ].join(' ')
}

/** Compact 軌道 / 流程 switch — same timeline, two displays. */
export function TimelineViewSwitch({
  className = ''
}: {
  className?: string
}): JSX.Element {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <div
      role="group"
      aria-label={t('nav.timeline')}
      className={['inline-flex overflow-hidden rounded-lg border border-ink-700 bg-ink-950 p-0.5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <NavLink
        to={TRACK}
        onClick={() => writeTimelinePagePref('classic')}
        className={chipClass(pathname === TRACK)}
      >
        {t('nav.timelineTrack')}
      </NavLink>
      <NavLink
        to={BOARD}
        onClick={() => writeTimelinePagePref('v2')}
        className={chipClass(pathname === BOARD)}
      >
        {t('nav.timelineBoard')}
      </NavLink>
    </div>
  )
}

/** Sidebar group: one Timeline feature, two display modes. */
export function TimelineViewNav(): JSX.Element {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const on = isTimelinePath(pathname)

  return (
    <div
      data-testid="nav-timeline-group"
      className={[
        'rounded-lg px-2 py-2',
        on ? 'bg-brand-950 ring-1 ring-brand-500/40' : 'hover:bg-ink-800/50'
      ].join(' ')}
    >
      <p
        className={[
          'px-1 text-[11px] font-semibold tracking-wide',
          on ? 'text-brand-100' : 'text-ink-400'
        ].join(' ')}
      >
        {t('nav.timeline')}
      </p>
      <p className="px-1 pb-1.5 pt-0.5 text-[10px] leading-snug text-ink-500">
        {t('nav.timelineViewHint')}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <NavLink
          to={TRACK}
          onClick={() => writeTimelinePagePref('classic')}
          className={chipClass(pathname === TRACK)}
        >
          {t('nav.timelineTrack')}
        </NavLink>
        <NavLink
          to={BOARD}
          onClick={() => writeTimelinePagePref('v2')}
          className={chipClass(pathname === BOARD)}
        >
          {t('nav.timelineBoard')}
        </NavLink>
      </div>
    </div>
  )
}
