import { describe, it, expect, vi } from 'vitest'
import { smoothScroll } from '../lib/helpers/scroll.js'
import { typeSlowly } from '../lib/helpers/type.js'

function mockPage() {
  return {
    evaluate: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
  }
}

describe('smoothScroll', () => {
  it('evaluates a scroll function on the page', async () => {
    const page = mockPage()
    await smoothScroll(page, { to: '.target', duration: 1000 })

    expect(page.evaluate).toHaveBeenCalledOnce()
    const [fn, opts] = page.evaluate.mock.calls[0]
    expect(opts.to).toBe('.target')
    expect(opts.duration).toBe(1000)
  })

  it('defaults to easeInOutQuad easing', async () => {
    const page = mockPage()
    await smoothScroll(page, { to: 500 })

    const [fn, opts] = page.evaluate.mock.calls[0]
    expect(opts.easing).toBe('easeInOutQuad')
  })

  it('accepts a numeric scroll target', async () => {
    const page = mockPage()
    await smoothScroll(page, { to: 800, duration: 500 })

    const [fn, opts] = page.evaluate.mock.calls[0]
    expect(opts.to).toBe(800)
  })
})

describe('typeSlowly', () => {
  it('clicks the selector then types with delay', async () => {
    const page = mockPage()
    await typeSlowly(page, '#input', 'hello')

    expect(page.click).toHaveBeenCalledWith('#input')
    expect(page.type).toHaveBeenCalledWith('#input', 'hello', { delay: 35 })
  })

  it('accepts a custom delay', async () => {
    const page = mockPage()
    await typeSlowly(page, '#input', 'hi', { delay: 50 })

    expect(page.type).toHaveBeenCalledWith('#input', 'hi', { delay: 50 })
  })
})
