/** Activity Log message builders for identity / continuity fallbacks. */

export function auditMissingEndFrame(opts: {
  entryId: string
  previousBeatIndex: number
}): { kind: string; message: string; level: 'warn'; meta: Record<string, unknown> } {
  return {
    kind: 'generation',
    level: 'warn',
    message: `continuity: beat missing previous end-frame (prev #${opts.previousBeatIndex})`,
    meta: {
      entryId: opts.entryId,
      previousBeatIndex: opts.previousBeatIndex,
      reason: 'missing-end-frame'
    }
  }
}

export function auditIdentityEditFallback(opts: {
  kind: string
  reason: 'no-edit-base' | 'force-pure' | 'generate'
}): { kind: string; message: string; level: 'info'; meta: Record<string, unknown> } {
  return {
    kind: 'generation',
    level: 'info',
    message: `identity: edit requested but fell back to generate (${opts.reason})`,
    meta: { mediaKind: opts.kind, reason: opts.reason }
  }
}

export function auditContinuityWriteFailed(opts: {
  entryId: string
}): { kind: string; message: string; level: 'warn'; meta: Record<string, unknown> } {
  return {
    kind: 'generation',
    level: 'warn',
    message: 'continuity: end-frame extract failed (text-only next beat)',
    meta: { entryId: opts.entryId, reason: 'end-frame-write-failed' }
  }
}

export function auditChainEndWait(opts: {
  entryId: string
}): { kind: string; message: string; level: 'info'; meta: Record<string, unknown> } {
  return {
    kind: 'generation',
    level: 'info',
    message: 'continuity: chain-end sequential (waiting on previous beat)',
    meta: { entryId: opts.entryId, continuityMode: 'chain-end' }
  }
}

export function auditGrokVoicesDropped(opts?: {
  entryId?: string
}): { kind: string; message: string; level: 'info'; meta: Record<string, unknown> } {
  return {
    kind: 'generation',
    level: 'info',
    message: 'grok: voices[] dropped after HTTP 400 (image_to_video fallback)',
    meta: {
      reason: 'grok-voices-dropped',
      ...(opts?.entryId ? { entryId: opts.entryId } : {})
    }
  }
}
