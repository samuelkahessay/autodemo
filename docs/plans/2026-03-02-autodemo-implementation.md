# autodemo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code plugin + npm package that lets Claude generate polished demo videos of any deployed web app.

**Architecture:** Monorepo with two deliverables — a Claude Code plugin (skill that guides the pipeline) and an npm package (`autodemo`) providing cinematic Playwright helpers and ffmpeg compositing. Claude handles UX judgment (what to demo, what order); the package handles reliable execution (recording, scrolling, compositing).

**Tech Stack:** Node.js (ESM), Playwright (video recording + browser automation), ffmpeg (compositing), vitest (testing)

---

### Task 1: Scaffold Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `packages/autodemo/package.json`
- Create: `packages/autodemo/vitest.config.js`
- Create: `plugin/.claude-plugin/plugin.json`

**Step 1: Create root package.json**

```json
{
  "name": "autodemo-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "plugin"
  ]
}
```

**Step 2: Create packages/autodemo/package.json**

```json
{
  "name": "autodemo",
  "version": "0.1.0",
  "description": "Cinematic demo video recording and compositing helpers for Playwright + ffmpeg",
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./helpers": "./helpers.js"
  },
  "files": [
    "index.js",
    "helpers.js",
    "lib/"
  ],
  "dependencies": {
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Create packages/autodemo/vitest.config.js**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    restoreMocks: true,
  },
})
```

**Step 4: Create plugin manifest**

```json
{
  "name": "autodemo",
  "description": "Generate polished demo videos of any web app. Claude analyzes your codebase, plans the demo, records with Playwright, and composites with ffmpeg.",
  "author": {
    "name": "skahessay"
  }
}
```

**Step 5: Create directory structure**

Run:
```bash
mkdir -p packages/autodemo/{lib/helpers,test}
mkdir -p plugin/.claude-plugin
mkdir -p plugin/skills/demo-video
```

**Step 6: Install dependencies**

Run: `npm install`

Expected: Workspaces linked, node_modules created.

**Step 7: Commit**

```bash
git add package.json packages/ plugin/.claude-plugin/
git commit -m "scaffold: monorepo with autodemo package and plugin skeleton"
```

---

### Task 2: Page Helpers — zoomPage, dismissOverlays, waitForIdle

**Files:**
- Create: `packages/autodemo/lib/helpers/zoom.js`
- Create: `packages/autodemo/lib/helpers/overlays.js`
- Create: `packages/autodemo/test/helpers-utility.test.js`

**Step 1: Write the failing tests**

```js
// packages/autodemo/test/helpers-utility.test.js
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/autodemo && npx vitest run test/helpers-utility.test.js`

Expected: FAIL — modules not found.

**Step 3: Implement zoomPage**

```js
// packages/autodemo/lib/helpers/zoom.js
export async function zoomPage(page, factor = 1.35) {
  await page.evaluate((f) => {
    document.body.style.zoom = String(f)
  }, factor)
}
```

**Step 4: Implement dismissOverlays and waitForIdle**

```js
// packages/autodemo/lib/helpers/overlays.js
const OVERLAY_SELECTORS = [
  '[aria-label="Close"]',
  '[aria-label="Dismiss"]',
  '.cookie-banner button',
  '.modal-close',
  '#cookie-consent button',
  '[class*="dismiss"]',
  '[class*="close-banner"]',
]

export async function dismissOverlays(page) {
  for (const selector of OVERLAY_SELECTORS) {
    const el = await page.$(selector)
    if (el) await el.click().catch(() => {})
  }
}

export async function waitForIdle(page, { timeout = 5000, stable = 500 } = {}) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {})
  await page.evaluate((ms) => {
    return new Promise((resolve) => {
      let timer = setTimeout(resolve, ms)
      const observer = new MutationObserver(() => {
        clearTimeout(timer)
        timer = setTimeout(() => { observer.disconnect(); resolve() }, ms)
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    })
  }, stable)
}
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/autodemo && npx vitest run test/helpers-utility.test.js`

Expected: All 5 tests PASS.

**Step 6: Commit**

```bash
git add packages/autodemo/lib/helpers/zoom.js packages/autodemo/lib/helpers/overlays.js packages/autodemo/test/helpers-utility.test.js
git commit -m "feat: add zoomPage, dismissOverlays, waitForIdle helpers"
```

---

### Task 3: Cinematic Helpers — smoothScroll, typeSlowly

**Files:**
- Create: `packages/autodemo/lib/helpers/scroll.js`
- Create: `packages/autodemo/lib/helpers/type.js`
- Create: `packages/autodemo/test/helpers-cinematic.test.js`

**Step 1: Write the failing tests**

```js
// packages/autodemo/test/helpers-cinematic.test.js
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/autodemo && npx vitest run test/helpers-cinematic.test.js`

Expected: FAIL — modules not found.

**Step 3: Implement smoothScroll**

```js
// packages/autodemo/lib/helpers/scroll.js
export async function smoothScroll(page, { to, duration = 1500, easing = 'easeInOutQuad' }) {
  await page.evaluate(({ to, duration, easing }) => {
    return new Promise((resolve) => {
      const target = typeof to === 'number'
        ? to
        : document.querySelector(to)?.getBoundingClientRect().top + window.scrollY

      if (target == null) { resolve(); return }

      const start = window.scrollY
      const distance = target - start
      const startTime = performance.now()

      const easings = {
        easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        linear: (t) => t,
      }
      const easeFn = easings[easing] || easings.easeInOutQuad

      function step(now) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        window.scrollTo(0, start + distance * easeFn(progress))
        if (progress < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { to, duration, easing })
}
```

**Step 4: Implement typeSlowly**

```js
// packages/autodemo/lib/helpers/type.js
export async function typeSlowly(page, selector, text, { delay = 35 } = {}) {
  await page.click(selector)
  await page.type(selector, text, { delay })
}
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/autodemo && npx vitest run test/helpers-cinematic.test.js`

Expected: All 5 tests PASS.

**Step 6: Commit**

```bash
git add packages/autodemo/lib/helpers/scroll.js packages/autodemo/lib/helpers/type.js packages/autodemo/test/helpers-cinematic.test.js
git commit -m "feat: add smoothScroll and typeSlowly cinematic helpers"
```

---

### Task 4: Helpers Barrel Export

**Files:**
- Create: `packages/autodemo/helpers.js`

**Step 1: Write the failing test**

```js
// packages/autodemo/test/helpers-barrel.test.js
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
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/autodemo && npx vitest run test/helpers-barrel.test.js`

Expected: FAIL — module not found.

**Step 3: Create barrel export**

```js
// packages/autodemo/helpers.js
export { zoomPage } from './lib/helpers/zoom.js'
export { smoothScroll } from './lib/helpers/scroll.js'
export { typeSlowly } from './lib/helpers/type.js'
export { dismissOverlays, waitForIdle } from './lib/helpers/overlays.js'
```

Note: compositor low-level exports (`generateTitleCard`, `concatSegments`, `reencodeConstantFps`) will be added in Task 5 after they're implemented.

**Step 4: Run test to verify it passes**

Run: `cd packages/autodemo && npx vitest run test/helpers-barrel.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/autodemo/helpers.js packages/autodemo/test/helpers-barrel.test.js
git commit -m "feat: add helpers barrel export for autodemo/helpers"
```

---

### Task 5: Compositor — ffmpeg Operations

**Files:**
- Create: `packages/autodemo/lib/compositor.js`
- Create: `packages/autodemo/test/compositor.test.js`

**Step 1: Write the failing tests**

```js
// packages/autodemo/test/compositor.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd, _args, cb) => cb(null, '', '')),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

import { execFile } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import {
  reencodeConstantFps,
  generateTitleCard,
  concatSegments,
  composeVideo,
} from '../lib/compositor.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reencodeConstantFps', () => {
  it('calls ffmpeg with correct encoding args', async () => {
    await reencodeConstantFps('input.webm', 'output.mp4')

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', 'input.webm', '-r', '30', '-crf', '18']),
      expect.any(Function)
    )
  })

  it('accepts custom fps and crf', async () => {
    await reencodeConstantFps('in.webm', 'out.mp4', { fps: 60, crf: 23 })

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-r', '60', '-crf', '23']),
      expect.any(Function)
    )
  })
})

describe('generateTitleCard', () => {
  it('calls ffmpeg with drawtext filter', async () => {
    await generateTitleCard({
      text: 'Hello World',
      output: '/tmp/title.mp4',
    })

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-vf', expect.stringContaining('drawtext')]),
      expect.any(Function)
    )
  })

  it('uses style colors when provided', async () => {
    await generateTitleCard({
      text: 'Test',
      style: { bgColor: '#ff0000', textColor: '#00ff00' },
      output: '/tmp/title.mp4',
    })

    const args = execFile.mock.calls[0][1]
    const colorInput = args.find((a) => a.includes('color=c='))
    expect(colorInput).toContain('0xff0000')
  })
})

describe('concatSegments', () => {
  it('writes a filelist and calls ffmpeg concat', async () => {
    await concatSegments(['/a.mp4', '/b.mp4'], '/out/final.mp4')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.filelist.txt'),
      expect.stringContaining("file '/a.mp4'")
    )
    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-f', 'concat', '-safe', '0']),
      expect.any(Function)
    )
  })
})

describe('composeVideo', () => {
  it('re-encodes segments, generates titles, and concatenates', async () => {
    await composeVideo({
      segments: ['/seg1.webm', '/seg2.webm'],
      titles: [{ text: 'Intro', duration: 3 }],
      output: '/out/demo.mp4',
    })

    // Should call ffmpeg multiple times: 2 re-encodes + 1 title + 1 concat
    expect(execFile).toHaveBeenCalledTimes(4)
  })

  it('works with no titles', async () => {
    await composeVideo({
      segments: ['/seg.webm'],
      output: '/out/demo.mp4',
    })

    // 1 re-encode + 1 concat
    expect(execFile).toHaveBeenCalledTimes(2)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/autodemo && npx vitest run test/compositor.test.js`

Expected: FAIL — module not found.

**Step 3: Implement compositor**

```js
// packages/autodemo/lib/compositor.js
import { execFile as execFileCb } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFileCb)

export async function reencodeConstantFps(input, output, { fps = 30, crf = 18 } = {}) {
  await mkdir(dirname(output), { recursive: true })
  await exec('ffmpeg', [
    '-i', input,
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium',
    '-r', String(fps), '-vsync', 'cfr',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function generateTitleCard({ text, style = {}, duration = 3, output }) {
  const bgColor = (style.bgColor || '#1a1a2e').replace('#', '0x')
  const textColor = (style.textColor || 'white').replace('#', '0x')
  const fontSize = style.fontSize || 72

  await mkdir(dirname(output), { recursive: true })

  const escapedText = text.replace(/'/g, "\\'").replace(/:/g, '\\:')
  const vf = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h-text_h)/2`

  await exec('ffmpeg', [
    '-f', 'lavfi',
    '-i', `color=c=${bgColor}:s=1920x1080:d=${duration}:r=30`,
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function concatSegments(segments, output) {
  const listFile = join(dirname(output), '.filelist.txt')
  const content = segments.map((s) => `file '${s}'`).join('\n')
  await writeFile(listFile, content)

  await mkdir(dirname(output), { recursive: true })
  await exec('ffmpeg', [
    '-f', 'concat', '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function composeVideo({ segments, titles = [], style = {}, output, fps = 30, crf = 18 }) {
  const tmpDir = join(dirname(output), '.autodemo-tmp')
  await mkdir(tmpDir, { recursive: true })

  // Re-encode all segments to constant framerate mp4
  const reencodedSegments = []
  for (let i = 0; i < segments.length; i++) {
    const reencoded = join(tmpDir, `segment-${i}.mp4`)
    await reencodeConstantFps(segments[i], reencoded, { fps, crf })
    reencodedSegments.push(reencoded)
  }

  // Generate title cards
  const titleCards = []
  for (let i = 0; i < titles.length; i++) {
    const cardPath = join(tmpDir, `title-${i}.mp4`)
    await generateTitleCard({
      text: titles[i].text,
      style,
      duration: titles[i].duration || 3,
      output: cardPath,
    })
    titleCards.push(cardPath)
  }

  // Interleave: title[i] then segment[i]
  const parts = []
  const maxLen = Math.max(titleCards.length, reencodedSegments.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < titleCards.length) parts.push(titleCards[i])
    if (i < reencodedSegments.length) parts.push(reencodedSegments[i])
  }

  await concatSegments(parts, output)
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/autodemo && npx vitest run test/compositor.test.js`

Expected: All 7 tests PASS.

**Step 5: Add compositor exports to helpers barrel**

Edit `packages/autodemo/helpers.js` — append:

```js
export { reencodeConstantFps, generateTitleCard, concatSegments } from './lib/compositor.js'
```

**Step 6: Update barrel test**

Add to the existing `test/helpers-barrel.test.js`:

```js
  it('exports compositor helpers', () => {
    expect(helpers.reencodeConstantFps).toBeTypeOf('function')
    expect(helpers.generateTitleCard).toBeTypeOf('function')
    expect(helpers.concatSegments).toBeTypeOf('function')
  })
```

**Step 7: Run all tests**

Run: `cd packages/autodemo && npx vitest run`

Expected: All tests PASS.

**Step 8: Commit**

```bash
git add packages/autodemo/lib/compositor.js packages/autodemo/test/compositor.test.js packages/autodemo/helpers.js packages/autodemo/test/helpers-barrel.test.js
git commit -m "feat: add ffmpeg compositor (reencodeConstantFps, generateTitleCard, concatSegments, composeVideo)"
```

---

### Task 6: Design Tokens — extractDesignTokens

**Files:**
- Create: `packages/autodemo/lib/design-tokens.js`
- Create: `packages/autodemo/test/design-tokens.test.js`

**Step 1: Write the failing tests**

```js
// packages/autodemo/test/design-tokens.test.js
import { describe, it, expect, vi } from 'vitest'

const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue({
    bgColor: 'rgb(0, 0, 0)',
    textColor: 'rgb(255, 255, 255)',
    accentColor: 'rgb(0, 170, 255)',
    fontFamily: 'Inter',
    customProperties: { '--bg': '#000', '--accent': '#00aaff' },
  }),
}

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}))

import { extractDesignTokens } from '../lib/design-tokens.js'

describe('extractDesignTokens', () => {
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/autodemo && npx vitest run test/design-tokens.test.js`

Expected: FAIL — module not found.

**Step 3: Implement extractDesignTokens**

```js
// packages/autodemo/lib/design-tokens.js
import { chromium } from 'playwright'

export async function extractDesignTokens(url) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const tokens = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement)
      const customProperties = {}
      for (const prop of rootStyle) {
        if (prop.startsWith('--')) {
          customProperties[prop] = rootStyle.getPropertyValue(prop).trim()
        }
      }

      const bodyStyle = getComputedStyle(document.body)
      const bgColor = bodyStyle.backgroundColor
      const textColor = bodyStyle.color

      const link = document.querySelector('a[href]')
      const btn = document.querySelector('button, [role="button"]')
      const accentColor =
        (link && getComputedStyle(link).color) ||
        (btn && getComputedStyle(btn).backgroundColor) ||
        textColor

      const fontFamily = bodyStyle.fontFamily.split(',')[0].trim().replace(/['"]/g, '')

      return { bgColor, textColor, accentColor, fontFamily, customProperties }
    })

    return tokens
  } finally {
    await browser.close()
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/autodemo && npx vitest run test/design-tokens.test.js`

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add packages/autodemo/lib/design-tokens.js packages/autodemo/test/design-tokens.test.js
git commit -m "feat: add extractDesignTokens for pulling design tokens from live URLs"
```

---

### Task 7: Recorder — recordSegment

**Files:**
- Create: `packages/autodemo/lib/recorder.js`
- Create: `packages/autodemo/test/recorder.test.js`

Note: the design doc API shows `recordSegment(page, ...)` but the implementation needs to create its own browser context (for video recording lifecycle). The first argument is `browser`, not `page`.

**Step 1: Write the failing tests**

```js
// packages/autodemo/test/recorder.test.js
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
  mockContext.newPage.mockResolvedValue(mockPage)
  mockBrowser.newContext.mockResolvedValue(mockContext)
  mockPage.video.mockReturnValue(mockVideo)
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/autodemo && npx vitest run test/recorder.test.js`

Expected: FAIL — module not found.

**Step 3: Implement recordSegment**

```js
// packages/autodemo/lib/recorder.js
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { zoomPage } from './helpers/zoom.js'
import { dismissOverlays, waitForIdle } from './helpers/overlays.js'
import { smoothScroll } from './helpers/scroll.js'
import { typeSlowly } from './helpers/type.js'

export async function recordSegment(browser, {
  name,
  actions,
  zoom = 1.35,
  outputDir = './segments',
  baseUrl = '',
  timeout = 30000,
}) {
  await mkdir(outputDir, { recursive: true })

  const context = await browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
  })

  const page = await context.newPage()
  const video = page.video()

  if (zoom !== 1) {
    await zoomPage(page, zoom)
  }

  for (const action of actions) {
    if (action.navigate) {
      const url = action.navigate.startsWith('http')
        ? action.navigate
        : baseUrl + action.navigate
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      await waitForIdle(page)
      await dismissOverlays(page)
    } else if (action.click) {
      await page.click(action.click)
    } else if (action.type) {
      await typeSlowly(page, action.type, action.text, { delay: action.delay || 35 })
    } else if (action.scrollTo) {
      await smoothScroll(page, {
        to: action.scrollTo,
        duration: action.duration || 1500,
      })
    } else if (action.wait) {
      await page.waitForTimeout(action.wait)
    }
  }

  // Hold final frame
  await page.waitForTimeout(1500)

  const outputPath = join(outputDir, `${name}.webm`)
  await context.close()
  await video.saveAs(outputPath)

  return outputPath
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/autodemo && npx vitest run test/recorder.test.js`

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add packages/autodemo/lib/recorder.js packages/autodemo/test/recorder.test.js
git commit -m "feat: add recordSegment with action execution and video lifecycle management"
```

---

### Task 8: Package Entry Point — index.js

**Files:**
- Create: `packages/autodemo/index.js`
- Create: `packages/autodemo/test/index.test.js`

**Step 1: Write the failing test**

```js
// packages/autodemo/test/index.test.js
import { describe, it, expect } from 'vitest'

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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/autodemo && npx vitest run test/index.test.js`

Expected: FAIL — module not found.

**Step 3: Create index.js**

```js
// packages/autodemo/index.js
export { recordSegment } from './lib/recorder.js'
export { composeVideo } from './lib/compositor.js'
export { extractDesignTokens } from './lib/design-tokens.js'
```

**Step 4: Run test to verify it passes**

Run: `cd packages/autodemo && npx vitest run test/index.test.js`

Expected: PASS.

**Step 5: Run all tests**

Run: `cd packages/autodemo && npx vitest run`

Expected: All tests across all files PASS.

**Step 6: Commit**

```bash
git add packages/autodemo/index.js packages/autodemo/test/index.test.js
git commit -m "feat: add package entry point exporting high-level API"
```

---

### Task 9: Plugin Skill — SKILL.md

**Files:**
- Create: `plugin/skills/demo-video/SKILL.md`
- Create: `plugin/package.json`

**Step 1: Create plugin package.json**

```json
{
  "name": "autodemo-plugin",
  "version": "0.1.0",
  "private": true
}
```

**Step 2: Write SKILL.md**

Create `plugin/skills/demo-video/SKILL.md` with the following content:

````markdown
---
name: demo-video
description: Generate polished demo videos of any deployed web app. Analyzes the codebase, plans segments, records with Playwright, and composites with ffmpeg.
---

# Demo Video Generator

You are generating a polished demo video for a web application. Follow this 5-phase pipeline exactly. Do not skip phases or record without user approval.

## Prerequisites Check

Before anything else, verify these dependencies are available:

1. Run `ffmpeg -version` — if missing, tell the user: "ffmpeg is required. Install with `brew install ffmpeg` (macOS) or see https://ffmpeg.org/download.html"
2. Run `npx autodemo --help` or check if `autodemo` is installed — if not, tell the user: "The autodemo package is required. Install with `npm install -g autodemo`"
3. Run `npx playwright install chromium` if Chromium is not already installed

If any dependency is missing, stop and help the user install it before proceeding.

## Phase 1: Understand the App

Read the codebase to build a mental model. Focus on:

- **README and docs** — what the app does, who it's for
- **Routes** — check framework routing (pages/ directory, router config, @page directives)
- **Interactive elements** — forms, buttons, key workflows
- **Visual highlights** — dashboards, charts, anything that looks impressive
- **Design tokens** — check for CSS custom properties, theme files, brand colors

Do NOT call any autodemo functions yet. This phase is pure analysis.

At the end of this phase, you should be able to describe the app in 2-3 sentences and list its main features.

## Phase 2: Plan the Demo

Propose a segment plan to the user. Format it exactly like this:

```
I'll record N segments for a ~X:XX video:

1. Title card: "App Name — tagline" (3s)
2. [Page/feature] — [what you'll show] (Xs)
3. [Page/feature] — [what you'll show] (Xs)
...

Want me to adjust anything before I start recording?
```

Guidelines for planning:
- Lead with the most impressive feature, not a login screen
- 4-7 segments is the sweet spot for a 2-3 minute video
- Each segment should be 15-30 seconds
- Include at least one interactive moment (typing, clicking, seeing results)
- End with something that builds confidence (GitHub repo, test results, architecture)

**WAIT for user approval before proceeding.** The user may reorder, drop, or add segments.

## Phase 3: Record

Write a Playwright script that uses the `autodemo` package. Save it as `record-demo.mjs` in the project root.

### Script Structure

```javascript
import { chromium } from 'playwright'
import { recordSegment } from 'autodemo'
// For custom segments, also import from 'autodemo/helpers':
// import { smoothScroll, typeSlowly, zoomPage, dismissOverlays, waitForIdle } from 'autodemo/helpers'

const browser = await chromium.launch({ headless: false })

// --- Segment 1: Feature Name ---
await recordSegment(browser, {
  name: '01-feature-name',
  actions: [
    { navigate: 'https://app-url.com/page' },
    { scrollTo: '.interesting-section' },
    { wait: 2000 },
  ],
  zoom: 1.35,
  outputDir: './segments',
})

// --- Segment 2: ... ---
// ...

await browser.close()
console.log('All segments recorded.')
```

### When to use high-level vs low-level API

- **Use `recordSegment()`** for straightforward page visits with standard actions (navigate, click, type, scroll, wait)
- **Use low-level helpers** when you need custom timing, conditional logic, or multiple scroll targets in one segment. In that case, create the browser context and manage video recording manually:

```javascript
import { smoothScroll, typeSlowly, zoomPage, waitForIdle } from 'autodemo/helpers'

const context = await browser.newContext({
  recordVideo: { dir: './segments', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
})
const page = await context.newPage()
const video = page.video()

await zoomPage(page, 1.35)
await page.goto('https://app-url.com')
await waitForIdle(page)
// ... custom logic ...

await page.waitForTimeout(1500) // hold final frame
await context.close()
await video.saveAs('./segments/custom-segment.webm')
```

### Running the script

Run the recording script:
```bash
node record-demo.mjs
```

If a segment fails, identify which one, fix the script for that segment only, and re-run. Each segment records independently.

## Phase 4: Compose

After all segments are recorded, write a composition script or run inline. You have two options:

### Option A: Use composeVideo (simple)

```javascript
import { composeVideo, extractDesignTokens } from 'autodemo'

const tokens = await extractDesignTokens('https://app-url.com')

await composeVideo({
  segments: [
    './segments/01-feature.webm',
    './segments/02-interaction.webm',
    // ...
  ],
  titles: [
    { text: 'App Name', duration: 3 },
    { text: 'Key Feature', duration: 2.5 },
    // ...
  ],
  style: {
    bgColor: tokens.bgColor,
    textColor: tokens.textColor,
  },
  output: './demo.mp4',
})
```

### Option B: Use low-level functions (custom)

```javascript
import { reencodeConstantFps, generateTitleCard, concatSegments } from 'autodemo/helpers'

// Re-encode each segment
await reencodeConstantFps('./segments/01.webm', './tmp/01.mp4')

// Generate cards
await generateTitleCard({ text: 'Title', style: { bgColor: '#080c12' }, output: './tmp/title.mp4' })

// Concat in your preferred order
await concatSegments(['./tmp/title.mp4', './tmp/01.mp4', ...], './demo.mp4')
```

## Phase 5: Deliver

Present the result to the user:

```
Demo video generated: ./demo.mp4

Duration: X:XX
Segments:
  1. Title card (3s)
  2. [Feature] (Xs)
  3. [Feature] (Xs)
  ...

Want me to:
- Re-record a specific segment?
- Adjust the pacing or zoom level?
- Change the title card text or colors?
```

## Defaults

- Resolution: 1920x1080
- Framerate: 30fps
- CRF: 18 (near-lossless for screen content)
- Zoom: 1.35x (good for most web apps at 1080p)
- Final frame hold: 1.5s per segment
- Typing speed: 35ms per character

The user can override any of these by telling you their preferences.

## Handling Common Issues

- **Auth required**: Ask the user how to handle it — pre-authenticated URL, cookie injection, or skip the page
- **App needs data**: Remind the user that the app should have realistic data before recording
- **Page too wide/narrow at zoom level**: Test zoom on one segment first, adjust before recording all
- **Overlays/banners**: The `dismissOverlays` helper handles common patterns. For app-specific overlays, write custom dismiss code
````

**Step 3: Commit**

```bash
git add plugin/
git commit -m "feat: add demo-video skill (SKILL.md) and plugin manifest"
```

---

### Task 10: End-to-End Smoke Test

**Files:**
- Create: `packages/autodemo/test/e2e.test.js`

This test verifies the full pipeline works with a real Playwright browser and a local HTML page. It requires Playwright and ffmpeg to be installed. Mark it as a separate test script so it doesn't run in CI without those dependencies.

**Step 1: Write the test**

```js
// packages/autodemo/test/e2e.test.js
import { describe, it, expect } from 'vitest'
import { chromium } from 'playwright'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { recordSegment } from '../lib/recorder.js'
import { composeVideo } from '../lib/compositor.js'

// Skip if ffmpeg is not available
let hasFFmpeg = false
try {
  execSync('ffmpeg -version', { stdio: 'ignore' })
  hasFFmpeg = true
} catch {}

const testDir = join(import.meta.dirname, '.e2e-tmp')

describe.runIf(hasFFmpeg)('e2e: full recording + compositing pipeline', () => {
  it('records a segment from a local HTML page and composes a video', async () => {
    // Clean up
    if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    mkdirSync(testDir, { recursive: true })

    // Create a simple test page
    const htmlPath = join(testDir, 'test.html')
    writeFileSync(htmlPath, `<!DOCTYPE html>
<html>
<head><title>Test App</title>
<style>
  body { font-family: sans-serif; background: #1a1a2e; color: white; padding: 40px; }
  h1 { font-size: 48px; }
  .content { margin-top: 200vh; } /* scrollable */
</style>
</head>
<body>
  <h1>Test Application</h1>
  <p>This is a test page for autodemo.</p>
  <div class="content"><p>Bottom content</p></div>
</body>
</html>`)

    const browser = await chromium.launch({ headless: true })

    // Record one segment
    const segmentPath = await recordSegment(browser, {
      name: 'test-page',
      actions: [
        { navigate: `file://${htmlPath}` },
        { wait: 1000 },
      ],
      zoom: 1,
      outputDir: join(testDir, 'segments'),
    })

    await browser.close()

    expect(existsSync(segmentPath)).toBe(true)

    // Compose
    const outputPath = join(testDir, 'demo.mp4')
    await composeVideo({
      segments: [segmentPath],
      titles: [{ text: 'Test Demo', duration: 2 }],
      style: { bgColor: '#1a1a2e', textColor: '#ffffff' },
      output: outputPath,
    })

    expect(existsSync(outputPath)).toBe(true)

    // Clean up
    rmSync(testDir, { recursive: true })
  }, 60000) // 60s timeout for recording + compositing
})
```

**Step 2: Run the test**

Run: `cd packages/autodemo && npx vitest run test/e2e.test.js`

Expected: PASS (if ffmpeg is installed), SKIPPED (if not).

**Step 3: Add e2e script to package.json**

Edit `packages/autodemo/package.json` scripts:

```json
"scripts": {
  "test": "vitest run --exclude test/e2e.test.js",
  "test:e2e": "vitest run test/e2e.test.js",
  "test:all": "vitest run"
}
```

**Step 4: Run all unit tests to confirm nothing broke**

Run: `cd packages/autodemo && npm test`

Expected: All unit tests PASS (e2e excluded).

**Step 5: Commit**

```bash
git add packages/autodemo/test/e2e.test.js packages/autodemo/package.json
git commit -m "test: add e2e smoke test for full recording + compositing pipeline"
```
