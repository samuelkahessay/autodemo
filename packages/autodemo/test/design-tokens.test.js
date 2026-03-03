import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPage, mockBrowser } = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn(),
    evaluate: vi.fn(),
  }

  const mockBrowser = {
    newPage: vi.fn(),
    close: vi.fn(),
  }

  return { mockPage, mockBrowser }
})

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}))

import { extractDesignTokens } from '../lib/design-tokens.js'

describe('extractDesignTokens', () => {
  beforeEach(async () => {
    const { chromium } = await import('playwright')
    chromium.launch.mockResolvedValue(mockBrowser)
    mockBrowser.newPage.mockResolvedValue(mockPage)
    mockBrowser.close.mockResolvedValue(undefined)
    mockPage.goto.mockResolvedValue(undefined)
    mockPage.evaluate.mockResolvedValue({
      bgColor: 'rgb(0, 0, 0)',
      textColor: 'rgb(255, 255, 255)',
      accentColor: 'rgb(0, 170, 255)',
      fontFamily: 'Inter',
      customProperties: { '--bg': '#000', '--accent': '#00aaff' },
    })
  })

  it('launches a headless browser and navigates to the URL', async () => {
    const { chromium } = await import('playwright')

    await extractDesignTokens('https://example.com')

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true })
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ waitUntil: 'domcontentloaded' })
    )
  })

  it('returns design tokens extracted from the page', async () => {
    const tokens = await extractDesignTokens('https://example.com')

    expect(tokens).toHaveProperty('bgColor')
    expect(tokens).toHaveProperty('textColor')
    expect(tokens).toHaveProperty('accentColor')
    expect(tokens).toHaveProperty('fontFamily')
    expect(tokens).toHaveProperty('customProperties')
  })

  it('closes the browser after extraction', async () => {
    await extractDesignTokens('https://example.com')

    expect(mockBrowser.close).toHaveBeenCalled()
  })
})
