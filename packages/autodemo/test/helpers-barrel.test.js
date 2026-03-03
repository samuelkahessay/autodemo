import { describe, it, expect } from 'vitest'
import * as helpers from '../helpers.js'

describe('autodemo/helpers barrel export', () => {
  it('exports all page helpers', () => {
    expect(helpers.zoomPage).toBeTypeOf('function')
    expect(helpers.dismissOverlays).toBeTypeOf('function')
    expect(helpers.waitForIdle).toBeTypeOf('function')
    expect(helpers.smoothScroll).toBeTypeOf('function')
    expect(helpers.typeSlowly).toBeTypeOf('function')
  })

  it('exports compositor helpers', () => {
    expect(helpers.reencodeConstantFps).toBeTypeOf('function')
    expect(helpers.generateTitleCard).toBeTypeOf('function')
    expect(helpers.concatSegments).toBeTypeOf('function')
  })
})
