import { describe, it, expect, vi } from 'vitest'

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
}))

import * as autodemo from '../index.js'

describe('autodemo package exports', () => {
  it('exports the high-level API', () => {
    expect(autodemo.recordSegment).toBeTypeOf('function')
    expect(autodemo.composeVideo).toBeTypeOf('function')
    expect(autodemo.extractDesignTokens).toBeTypeOf('function')
  })

  it('does not export low-level helpers from the main entry', () => {
    expect(autodemo.smoothScroll).toBeUndefined()
    expect(autodemo.typeSlowly).toBeUndefined()
    expect(autodemo.zoomPage).toBeUndefined()
  })
})
