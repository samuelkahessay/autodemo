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
