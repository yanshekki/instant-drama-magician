import { describe, expect, it } from 'vitest'
import {
  clampSdCfg,
  clampSdDenoising,
  clampSdSteps,
  coerceSdSampler,
  decorateSdPrompt,
  DEFAULT_SD_NEGATIVE,
  animateDiffFrameCount,
  clampSdMotionBucket,
  clampSdVideoFps,
  comfySamplerName,
  detectSdBackend,
  mergeSdNegative,
  sdAuthHeaders,
  SD_COMFY_VIDEO_SLOTS,
  sdComfySlotGuide,
  sdNextFrameCount,
  idmSizeFromAspect,
  sdSizeFromAspect,
  sdSizeFromImageSize,
  stabilityApiRoot
} from './stableDiffusion'

describe('stableDiffusion mapping', () => {
  it('maps IDM sizes to SDXL-safe pixels', () => {
    expect(sdSizeFromImageSize('1024x1024')).toEqual({
      width: 1024,
      height: 1024,
      aspectRatio: '1:1'
    })
    expect(sdSizeFromImageSize('1792x1024')).toEqual({
      width: 1344,
      height: 768,
      aspectRatio: '16:9'
    })
    expect(sdSizeFromImageSize('1024x1792')).toEqual({
      width: 768,
      height: 1344,
      aspectRatio: '9:16'
    })
    expect(sdSizeFromImageSize(undefined).aspectRatio).toBe('16:9')
    expect(sdSizeFromAspect('9:16').aspectRatio).toBe('9:16')
    expect(sdSizeFromAspect('1:1').width).toBe(1024)
    expect(sdSizeFromAspect('16:9').width).toBe(1344)
    expect(sdSizeFromAspect(undefined).aspectRatio).toBe('16:9')
    expect(idmSizeFromAspect('9:16')).toBe('1024x1792')
    expect(idmSizeFromAspect('1:1')).toBe('1024x1024')
    expect(idmSizeFromAspect()).toBe('1792x1024')
  })

  it('detects Stability vs WebUI from the base URL', () => {
    expect(detectSdBackend('http://127.0.0.1:7860')).toBe('webui')
    expect(detectSdBackend('https://api.stability.ai')).toBe('stability')
    expect(detectSdBackend('https://api.stability.ai/v2beta')).toBe('stability')
  })

  it('clamps sampler / steps / cfg / denoising', () => {
    expect(clampSdSteps(3)).toBe(10)
    expect(clampSdSteps(99)).toBe(50)
    expect(clampSdCfg(0)).toBe(1)
    expect(clampSdDenoising(1)).toBe(0.8)
    expect(coerceSdSampler('Euler a')).toBe('Euler a')
    expect(coerceSdSampler('nope')).toBe('DPM++ 2M')
  })

  it('decorates prompt from artStyle without doubling', () => {
    expect(decorateSdPrompt('a hero', 'anime')).toBe(
      'a hero, anime, illustration'
    )
    expect(decorateSdPrompt('a hero, anime look', 'manga')).toBe(
      'a hero, anime look'
    )
    expect(decorateSdPrompt('street', 'cinematic')).toContain('photorealistic')
    expect(decorateSdPrompt('plain', '')).toBe('plain')
    expect(decorateSdPrompt('cinematic street', 'photoreal')).toBe(
      'cinematic street'
    )
    expect(decorateSdPrompt('', 'anime')).toBe(', anime, illustration')
    expect(decorateSdPrompt('x', 'watercolor')).toBe('x')
  })

  it('merges extra negatives once', () => {
    expect(mergeSdNegative()).toBe(DEFAULT_SD_NEGATIVE)
    expect(mergeSdNegative('text')).toContain('text')
    expect(mergeSdNegative(DEFAULT_SD_NEGATIVE)).toBe(DEFAULT_SD_NEGATIVE)
  })

  it('maps clip duration to AnimateDiff / SD.Next frames', () => {
    expect(animateDiffFrameCount(2, 8)).toBe(16)
    expect(animateDiffFrameCount(6, 8)).toBe(48)
    expect(sdNextFrameCount(4, 8)).toBeGreaterThanOrEqual(16)
    expect(sdAuthHeaders('').Authorization).toBeUndefined()
    expect(sdAuthHeaders('user:pw').Authorization?.startsWith('Basic ')).toBe(
      true
    )
    expect(sdAuthHeaders('sk-x').Authorization).toBe('Bearer sk-x')
    expect(stabilityApiRoot('https://api.stability.ai/v2beta')).toBe(
      'https://api.stability.ai'
    )
    expect(clampSdMotionBucket(0)).toBe(1)
    expect(clampSdVideoFps(3)).toBe(6)
    expect(comfySamplerName('Euler a')).toBe('euler_ancestral')
    expect(comfySamplerName('nope')).toBe('dpmpp_2m')
    expect(sdComfySlotGuide()).toContain('{{PROMPT}}')
    expect(sdComfySlotGuide()).toContain('{{IMAGE}}')
    expect(SD_COMFY_VIDEO_SLOTS).toHaveLength(10)
  })
})
