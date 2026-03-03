import { describe, it, expect, vi } from 'vitest'
import { zoomPage } from '../lib/helpers/zoom.js'
import { dismissOverlays, waitForIdle } from '../lib/helpers/overlays.js'

function mockPage() {
  return {
    evaluate: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  }
}

describe('zoomPage', () => {
  it('evaluates zoom on the page with default factor', async () => {
    const page = mockPage()
    await zoomPage(page)
    expect(page.evaluate).toHaveBeenCalledOnce()
    const [fn, arg] = page.evaluate.mock.calls[0]
    expect(arg).toBe(1.35)
  })

  it('accepts a custom zoom factor', async () => {
    const page = mockPage()
    await zoomPage(page, 2.0)
    const [fn, arg] = page.evaluate.mock.calls[0]
    expect(arg).toBe(2.0)
  })
})

describe('dismissOverlays', () => {
  it('clicks elements matching known overlay selectors', async () => {
    const mockEl = { click: vi.fn().mockResolvedValue(undefined) }
    const page = mockPage()
    page.$.mockResolvedValue(mockEl)

    await dismissOverlays(page)

    expect(page.$).toHaveBeenCalled()
    expect(mockEl.click).toHaveBeenCalled()
  })

  it('does not throw when no overlays found', async () => {
    const page = mockPage()
    page.$.mockResolvedValue(null)

    await expect(dismissOverlays(page)).resolves.not.toThrow()
  })
})

describe('waitForIdle', () => {
  it('waits for network idle then DOM stability', async () => {
    const page = mockPage()
    await waitForIdle(page)

    expect(page.waitForLoadState).toHaveBeenCalledWith(
      'networkidle',
      expect.objectContaining({ timeout: expect.any(Number) })
    )
    expect(page.evaluate).toHaveBeenCalledOnce()
  })

  it('does not throw if networkidle times out', async () => {
    const page = mockPage()
    page.waitForLoadState.mockRejectedValue(new Error('timeout'))

    await expect(waitForIdle(page)).resolves.not.toThrow()
  })
})
