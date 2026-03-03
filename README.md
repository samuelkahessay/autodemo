# autodemo

Record polished demo videos of any web app. Playwright handles the browser, ffmpeg handles the compositing, you handle the story.

**Two ways to use it:**

1. **Claude Code plugin** — tell Claude to `/demo-video` your app and it plans segments, records, and composites automatically
2. **npm package** — `npm install @skahessay/autodemo` and script your own recordings

## Quick Start

### Prerequisites

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/download.html) (`brew install ffmpeg` on macOS)
- Playwright Chromium (`npx playwright install chromium`)

### Install

```bash
npm install @skahessay/autodemo
```

### Record a segment

```javascript
import { chromium } from 'playwright'
import { recordSegment } from '@skahessay/autodemo'

const browser = await chromium.launch()

await recordSegment(browser, {
  name: '01-landing',
  actions: [
    { navigate: 'https://your-app.com' },
    { scrollTo: '.features' },
    { wait: 2000 },
  ],
})

await browser.close()
```

### Compose into a final video

```javascript
import { composeVideo, extractDesignTokens } from '@skahessay/autodemo'

// Pull brand colors from the live site
const tokens = await extractDesignTokens('https://your-app.com')

await composeVideo({
  segments: ['./segments/01-landing.webm', './segments/02-dashboard.webm'],
  titles: [
    { text: 'Your App', duration: 3 },
    { text: 'Dashboard', duration: 2.5 },
  ],
  style: { bgColor: tokens.bgColor, textColor: tokens.textColor },
  output: './demo.mp4',
})
```

## API

### High-level (`@skahessay/autodemo`)

#### `recordSegment(browser, options)`

Records a single demo segment with automatic zoom, overlay dismissal, and idle detection.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | required | Output filename (without extension) |
| `actions` | `Action[]` | required | Sequence of actions to perform |
| `zoom` | `number` | `1.35` | Page zoom factor |
| `outputDir` | `string` | `'./segments'` | Directory for recorded videos |
| `baseUrl` | `string` | `''` | Prefix for relative navigate URLs |
| `timeout` | `number` | `30000` | Navigation timeout in ms |

**Actions:**

| Action | Description |
|--------|-------------|
| `{ navigate: '/page' }` | Go to URL (relative to `baseUrl` or absolute) |
| `{ click: '.selector' }` | Click an element |
| `{ type: '.selector', text: 'hello' }` | Type into a field (35ms/char default) |
| `{ scrollTo: '.selector' }` | Smooth scroll to element (1.5s default) |
| `{ wait: 2000 }` | Pause for N milliseconds |

#### `composeVideo(options)`

Re-encodes segments to constant framerate, generates title cards, interleaves them, and concatenates into a final MP4.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `segments` | `string[]` | required | Paths to recorded .webm files |
| `titles` | `{ text, duration? }[]` | `[]` | Title cards to interleave before segments |
| `style` | `{ bgColor?, textColor?, fontSize? }` | dark theme | Title card styling |
| `output` | `string` | required | Output .mp4 path |
| `fps` | `number` | `30` | Target framerate |
| `crf` | `number` | `18` | Quality (lower = better, 18 is near-lossless) |

#### `extractDesignTokens(url)`

Launches a headless browser, visits the URL, and extracts CSS custom properties to use as title card styling.

Returns `{ bgColor, textColor, fontFamily, accentColor }`.

### Low-level (`@skahessay/autodemo/helpers`)

For custom recording logic where `recordSegment` isn't flexible enough:

| Function | Description |
|----------|-------------|
| `smoothScroll(page, { to, duration?, easing? })` | Cinematic scroll to selector or Y offset |
| `typeSlowly(page, selector, text, { delay? })` | Human-speed typing |
| `zoomPage(page, factor)` | Set CSS zoom level |
| `dismissOverlays(page)` | Click common cookie/modal dismiss buttons |
| `waitForIdle(page, { timeout?, stable?, maxWait? })` | Wait for network + DOM stability |
| `reencodeConstantFps(input, output, { fps?, crf? })` | Re-encode video to constant framerate |
| `generateTitleCard({ text, style?, duration?, output })` | Generate a title card MP4 |
| `concatSegments(segments, output)` | Concatenate MP4 files |

## Claude Code Plugin

Install the plugin to let Claude plan and record demos conversationally:

```bash
claude plugin add samuelkahessay/autodemo
```

Then use the `/demo-video` skill in any project. Claude will:

1. Read your codebase to understand the app
2. Propose a segment plan
3. Record with Playwright
4. Composite with ffmpeg
5. Deliver the final MP4

## Defaults

| Setting | Value |
|---------|-------|
| Resolution | 1920x1080 |
| Framerate | 30 fps |
| Quality (CRF) | 18 |
| Zoom | 1.35x |
| Final frame hold | 1.5s per segment |
| Typing speed | 35ms per character |

## Development

```bash
git clone https://github.com/samuelkahessay/autodemo.git
cd autodemo
npm install
npm test -w packages/autodemo         # unit tests
npm run test:e2e -w packages/autodemo  # e2e (requires ffmpeg)
```

## License

MIT
