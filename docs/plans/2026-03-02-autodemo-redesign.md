# autodemo — Claude Code Plugin + npm Package

## Context

Originally designed as a CLI tool. Redesigned as a Claude Code plugin because the core value — deciding what's demo-worthy and scripting the narrative — is an AI judgment problem, not an automation problem. The user should be able to say "make me a demo video" and have Claude handle it.

Evolved from a working prototype that generated a 2:48 demo video for a Wealthsimple AI Builder submission using Playwright + ffmpeg. See `demo-video-generator-design.md` for the original design and technical lessons learned.

## Architecture

Two deliverables in a monorepo:

1. **Claude Code plugin** (marketplace) — a skill that guides Claude through the demo video pipeline
2. **npm package** (`autodemo`) — reliable building blocks for cinematic recording and compositing

```
autodemo/
├── plugin/                        ← Claude Code plugin
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   │   └── demo-video/
│   │       └── SKILL.md
│   ├── README.md
│   └── LICENSE
│
├── packages/
│   └── autodemo/                  ← npm package
│       ├── package.json
│       ├── index.mjs              ← high-level exports
│       ├── helpers.mjs            ← low-level exports
│       └── lib/
│           ├── recorder.mjs
│           ├── compositor.mjs
│           ├── design-tokens.mjs
│           └── helpers/
│               ├── scroll.mjs
│               ├── type.mjs
│               ├── zoom.mjs
│               └── overlays.mjs
│
├── package.json                   ← monorepo root (workspaces)
└── README.md
```

The plugin bundles no runtime code — just the skill. The npm package is resolved at runtime via `npx` or local install.

### Division of Responsibility

| Concern | Handled by |
|---|---|
| What pages should we demo? | Claude (reading codebase) |
| What order, what to type, what to focus on? | Claude (UX judgment) |
| Smooth scroll at 60fps with easing | `autodemo` npm package |
| Record a segment as video | `autodemo` npm package |
| Stitch segments + title cards | `autodemo` npm package |
| When to ask the user for input | Plugin skill |

## npm Package API

### High-level API

For the 80% case — Claude describes WHAT to record, the package handles HOW.

```js
import { recordSegment, composeVideo, extractDesignTokens } from 'autodemo'

// Extract the app's visual identity for matching title cards
const tokens = await extractDesignTokens('https://app.example.com')
// → { bgColor: '#080c12', accentColor: '#00aaff', fontFamily: 'Inter', ... }

// Record a segment
await recordSegment(page, {
  name: 'compliance-scanner',
  actions: [
    { navigate: '/compliance' },
    { type: '#scan-content', text: 'Customer data: SIN 123-456-789' },
    { click: '#scan-btn' },
    { wait: 3000 },
    { scrollTo: '.results-panel' }
  ],
  zoom: 1.35,
  outputDir: './segments'
})

// Stitch segments + generate title cards
await composeVideo({
  segments: ['./segments/compliance-scanner.webm', ...],
  titles: [
    { text: 'AI-Powered Compliance', duration: 3 },
    { text: 'Real-Time Scanning', duration: 2.5 }
  ],
  style: tokens,
  output: './demo.mp4'
})
```

### Low-level API

For full creative control — Claude writes custom Playwright logic using individual helpers.

```js
import {
  smoothScroll, typeSlowly, zoomPage,
  dismissOverlays, waitForIdle,
  generateTitleCard, concatSegments, reencodeConstantFps
} from 'autodemo/helpers'

await zoomPage(page, 1.35)
await dismissOverlays(page)
await page.goto('/dashboard')
await waitForIdle(page)
await smoothScroll(page, { to: '.metrics-panel', duration: 1500, easing: 'easeInOutQuad' })
await typeSlowly(page, '#search', 'quarterly revenue', { delay: 35 })

await reencodeConstantFps('./segments/raw.webm', './segments/dashboard.mp4', { fps: 30 })
await generateTitleCard({ text: 'Dashboard Overview', style: tokens, output: './cards/title.mp4' })
await concatSegments(['./cards/title.mp4', './segments/dashboard.mp4'], './demo.mp4')
```

### Key design decisions

- **`recordSegment` manages the browser context lifecycle** — creates context with video recording, runs actions, closes context, renames the output file. Encapsulates the Playwright video gotchas (call `page.video().path()` before `page.close()`, rename after `context.close()`).
- **`composeVideo` is a single call** — handles re-encoding to constant framerate, title card generation, and concatenation. Hides all ffmpeg complexity.
- **`extractDesignTokens` hits the live URL** — loads the page in a headless browser, reads computed CSS custom properties and dominant colors. No codebase analysis needed.
- **Low-level helpers are individually importable** from `autodemo/helpers`.
- **No UX opinions in the package** — it never decides what to demo. That's Claude's job via the skill.

## Skill Pipeline

The skill (SKILL.md) defines a 5-phase pipeline:

### Phase 1: Understand the App

Claude reads the codebase — routes, components, README, docs. Builds a mental model of what the app does, what pages exist, what's interactive, and what's demo-worthy. No package calls here — pure code reading and reasoning.

### Phase 2: Plan the Demo

Claude proposes a segment list to the user:

```
I'll record 5 segments for a ~2:30 video:

1. Title card: "AppName — tagline" (3s)
2. Dashboard overview — scroll through metrics panels (20s)
3. Compliance scanner — type sample data, trigger scan, show results (30s)
4. Settings page — show configuration options (15s)
5. GitHub repo — show CI/CD pipeline and recent commits (20s)

Transitions between each segment. Want me to adjust anything?
```

The user can edit — reorder, drop, add focus areas. This is the human-in-the-loop moment before recording.

### Phase 3: Record

Claude writes a Playwright script using the `autodemo` package:
- Simple segments → `recordSegment()` with action list
- Complex interactions → custom Playwright code with low-level helpers

Each segment is recorded independently. If segment 3 fails, Claude re-records just that one.

### Phase 4: Compose

Claude calls `composeVideo()` or uses the low-level compositing helpers. Title cards match the app's design tokens extracted in Phase 1.

### Phase 5: Deliver

Claude presents:
- Path to `demo.mp4`
- Duration and segment breakdown
- Offer to re-record specific segments or adjust pacing

### Skill behavior

- Always asks for approval after Phase 2 — never records without user seeing the plan
- Checks for `ffmpeg` and Playwright at the start — guides installation if missing
- Defaults to 1080p, 30fps, CRF 18 — user can override
- Handles auth gracefully — if a page requires login, asks the user how to handle it

## Plugin Distribution

### plugin.json

```json
{
  "name": "autodemo",
  "description": "Generate polished demo videos of any web app. Claude analyzes your codebase, plans the demo, records with Playwright, and composites with ffmpeg.",
  "author": {
    "name": "skahessay"
  }
}
```

### Runtime dependencies

| Dependency | Resolution | Required? |
|---|---|---|
| `autodemo` npm package | `npx autodemo` or local install | Yes |
| Playwright + Chromium | `npx playwright install chromium` | Yes |
| ffmpeg | Must be on PATH | Yes |
| Playwright MCP plugin | Not required — autodemo uses Playwright programmatically | No |

### First-run experience

On first `/demo-video`, the skill guides Claude to:
1. Check `ffmpeg --version` — suggest `brew install ffmpeg` if missing
2. Check `autodemo` availability — `npm install -g autodemo` or use `npx`
3. Check Playwright browsers — `npx playwright install chromium` if needed
4. Proceed to Phase 1

## Error Handling

### Recording failures

- **Segment fails** — each segment is independent. Claude reports which failed and retries just that one.
- **Auth required** — skill asks the user: cookie injection, pre-auth URL, or skip.
- **Overlays (cookie banners, modals)** — `dismissOverlays()` tries common patterns. If it fails, Claude writes custom dismiss logic.
- **Timeout** — configurable per segment (default 30s). Claude bumps it for slow pages.

### Compositing failures

- **ffmpeg not found** — caught at the start, not after recording.
- **Mismatched resolutions** — `composeVideo` enforces consistency, scales if needed.
- **Variable framerate** — `reencodeConstantFps` always runs before concat, baked into the high-level API.

### App-specific edge cases

- **SPAs with slow transitions** — `waitForIdle()` uses network idle + no DOM mutations for 500ms.
- **Canvas/WebGL** — Playwright records the viewport so these work visually, but `smoothScroll` won't work inside a canvas.
- **Responsive layouts** — CSS zoom triggers reflow. Aggressive breakpoints might cause mobile layout. Skill tells Claude to test zoom before recording all segments.

## Out of Scope (v1)

- **Voiceover/narration** — skill can generate a text script with timestamps, but no audio synthesis
- **App data seeding** — package records what's on screen; data is the user's responsibility
- **CI/CD integration** — v1 is local-only
