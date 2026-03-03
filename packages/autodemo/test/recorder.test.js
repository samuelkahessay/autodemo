import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

const mockVideo = {
  saveAs: vi.fn().mockResolvedValue(undefined),
}

const mockPage = {
  video: vi.fn().mockReturnValue(mockVideo),
  evaluate: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  type: vi.fn().mockResolvedValue(undefined),
  $: vi.fn().mockResolvedValue(null),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
}

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
}

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
}

import { recordSegment } from '../lib/recorder.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockBrowser.newContext.mockResolvedValue(mockContext)
  mockContext.newPage.mockResolvedValue(mockPage)
  mockContext.close.mockResolvedValue(undefined)
  mockPage.video.mockReturnValue(mockVideo)
  mockPage.evaluate.mockResolvedValue(undefined)
  mockPage.goto.mockResolvedValue(undefined)
  mockPage.click.mockResolvedValue(undefined)
  mockPage.type.mockResolvedValue(undefined)
  mockPage.$.mockResolvedValue(null)
  mockPage.waitForTimeout.mockResolvedValue(undefined)
  mockPage.waitForLoadState.mockResolvedValue(undefined)
  mockVideo.saveAs.mockResolvedValue(undefined)
})

describe('recordSegment', () => {
  it('creates a context with video recording', async () => {
    await recordSegment(mockBrowser, {
      name: 'test-segment',
      actions: [],
      outputDir: '/tmp/segments',
    })

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        recordVideo: expect.objectContaining({
          dir: '/tmp/segments',
          size: { width: 1920, height: 1080 },
        }),
      })
    )
  })

  it('applies zoom before executing actions', async () => {
    await recordSegment(mockBrowser, {
      name: 'test',
      actions: [{ navigate: 'https://example.com' }],
      zoom: 1.5,
      outputDir: '/tmp/seg',
    })

    // First evaluate call should be zoom
    expect(mockPage.evaluate).toHaveBeenCalled()
    const firstCall = mockPage.evaluate.mock.calls[0]
    expect(firstCall[1]).toBe(1.5)
  })

  it('executes navigate actions', async () => {
    await recordSegment(mockBrowser, {
      name: 'test',
      actions: [{ navigate: 'https://example.com/page' }],
      outputDir: '/tmp/seg',
    })

    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.any(Object)
    )
  })

  it('executes click actions', async () => {
    await recordSegment(mockBrowser, {
      name: 'test',
      actions: [{ click: '#btn' }],
      outputDir: '/tmp/seg',
    })

    expect(mockPage.click).toHaveBeenCalledWith('#btn')
  })

  it('executes wait actions', async () => {
    await recordSegment(mockBrowser, {
      name: 'test',
      actions: [{ wait: 2000 }],
      outputDir: '/tmp/seg',
    })

    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000)
  })

  it('closes context and saves video with correct name', async () => {
    const result = await recordSegment(mockBrowser, {
      name: 'my-segment',
      actions: [],
      outputDir: '/tmp/segments',
    })

    expect(mockContext.close).toHaveBeenCalled()
    expect(mockVideo.saveAs).toHaveBeenCalledWith('/tmp/segments/my-segment.webm')
    expect(result).toBe('/tmp/segments/my-segment.webm')
  })

  it('holds final frame for 1.5s before closing', async () => {
    await recordSegment(mockBrowser, {
      name: 'test',
      actions: [],
      outputDir: '/tmp/seg',
    })

    // Last waitForTimeout before context.close should be 1500
    const waitCalls = mockPage.waitForTimeout.mock.calls
    const lastWait = waitCalls[waitCalls.length - 1]
    expect(lastWait[0]).toBe(1500)
  })
})
