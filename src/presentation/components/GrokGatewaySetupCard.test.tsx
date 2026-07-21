import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

import { GrokGatewaySetupCard } from './GrokGatewaySetupCard'

describe('GrokGatewaySetupCard', () => {
  afterEach(() => cleanup())

  it('ready state', () => {
    render(
      <GrokGatewaySetupCard
        status={{
          state: 'ready',
          message: 'ok',
          healthOk: true,
          grokPath: '/grok',
          gctoacPath: '/g',
          keyReady: true
        }}
        busy={false}
        onRecheck={() => undefined}
        onCopyInstall={() => undefined}
        onOpenInstallPage={() => undefined}
      />
    )
    expect(screen.getByText('settings.grokSetupReadyBlurb')).toBeTruthy()
    expect(screen.getByText('settings.gatewayReadyManaged')).toBeTruthy()
  })


  it('need_build shows install actions', () => {
    const onCopy = vi.fn()
    const onOpen = vi.fn()
    render(
      <GrokGatewaySetupCard
        status={{
          state: 'grok_build_missing',
          message: 'missing',
          healthOk: false,
          grokPath: null,
          gctoacPath: null
        }}
        busy={false}
        onRecheck={() => undefined}
        onCopyInstall={onCopy}
        onOpenInstallPage={onOpen}
      />
    )
    expect(screen.getByText('settings.grokSetupNeedBuildBlurb')).toBeTruthy()
    fireEvent.click(screen.getByText('settings.copyInstallCmd'))
    expect(onCopy).toHaveBeenCalled()
    fireEvent.click(screen.getByText('settings.grokOpenInstallPage'))
    expect(onOpen).toHaveBeenCalled()
    fireEvent.click(screen.getByText('settings.grokRecheck'))
  })



  it('need_package, unhealthy, checking, busy, null status', () => {
    for (const status of [
      {
        state: 'gateway_missing',
        message: 'm',
        healthOk: false,
        grokPath: '/g',
        gctoacPath: null
      },
      {
        state: 'unhealthy',
        message: 'm',
        healthOk: false,
        grokPath: '/g',
        gctoacPath: '/c'
      },
      {
        state: 'gateway_starting',
        message: 'm',
        healthOk: false,
        grokPath: '/g',
        gctoacPath: '/c'
      },
      {
        state: 'error',
        message: 'm',
        healthOk: false,
        grokPath: null,
        gctoacPath: null
      },
      null
    ] as const) {
      const { unmount } = render(
        <GrokGatewaySetupCard
          status={status}
          busy={status === null}
          onRecheck={() => undefined}
          onCopyInstall={() => undefined}
          onOpenInstallPage={() => undefined}
        />
      )
      expect(screen.getByText('settings.grokSetupTitle')).toBeTruthy()
      unmount()
    }
  })
})
