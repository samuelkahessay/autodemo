# autodemo — Programmatic Demo Video Generator

## What We Built (prd-to-prod, March 2 2026)

A 2:48 demo video for a Wealthsimple AI Builder submission, generated entirely programmatically:
- **Playwright** recorded 7 browser segments (app pages + GitHub)
- **ffmpeg** generated title/transition cards and composited the final MP4
- **CSS zoom** (1.35x) made content fill the 1080p frame
- **Smooth scroll + deliberate typing** created cinematic pacing

The whole pipeline: `node record-demo.mjs` → `bash compose.sh` → `demo.mp4`

Total wall-clock time from first script to final video: ~2 hours (including iteration on zoom, data seeding, segment tightening).

## The Generalizable Pattern

Given any deployed web app + its source repo, generate a polished demo video by:

1. **Discover** — Read the codebase to understand pages, routes, interactive elements
2. **Script** — Generate a Playwright recording script with cinematic helpers
3. **Record** — Run the script, capturing each segment as video
4. **Composite** — Generate title/transition cards, stitch everything with ffmpeg

## Why This Works

- The app IS the demo — no separate presentation layer needed
- Playwright captures exactly what a viewer would see
- CSS zoom solves the "too small at 1080p" problem without resolution loss
- ffmpeg drawtext generates cards that match the app's design tokens
- Segment-based recording means you can re-record one part without redoing everything

## CLI Tool Design: `autodemo`

### Usage

```bash
# Full auto — analyze repo, generate script, record, composite
autodemo https://github.com/user/repo --url https://app.example.com

# Generate script only (for human review/editing before recording)
autodemo generate https://github.com/user/repo --url https://app.example.com

# Record from existing script
autodemo record demo-script.mjs

# Composite from existing segments
autodemo compose segments/
```

### How It Would Work

#### Phase 1: Discover (`autodemo analyze`)

Read the codebase to build a page map:

```
Input:  GitHub repo URL (or local path)
Output: pages.json — route map with selectors, interactive elements, page purpose
```

What to extract:
- **Routes** — from framework routing (Razor `@page`, Next.js pages/, React Router, etc.)
- **Interactive elements** — forms, buttons, dropdowns (by ID, class, aria-label)
- **Page sections** — headings, panels, cards (scroll targets)
- **Design tokens** — CSS custom properties for colors, fonts (for matching title cards)
- **API endpoints** — for understanding what data powers each page
- **README/docs** — for understanding what the app does (narration context)

Framework detection matters here. A Razor app has different patterns than a Next.js app. The analyzer needs adapters:

```
analyzers/
  razor.mjs      — @page directives, .cshtml structure, asp-* attributes
  nextjs.mjs     — pages/ or app/ directory, getServerSideProps, API routes
  react-spa.mjs  — React Router, component tree
  generic.mjs    — fallback: crawl deployed URL, extract from DOM
```

#### Phase 2: Script (`autodemo generate`)

Generate a Playwright recording script from the page map:

```
Input:  pages.json + user hints (optional)
Output: record-demo.mjs — ready-to-run Playwright script
```

The generator creates:
- **Segment functions** — one per page/feature to demo
- **Cinematic helpers** — smooth scroll, deliberate typing, wait
- **CSS zoom** — calibrated to the app's max-width breakpoint
- **Segment ordering** — logical flow (overview → details → evidence)
- **Title/transition text** — extracted from page headings or README

User hints (optional `autodemo.yml`):
```yaml
# Override or guide the generator
segments:
  - page: /compliance
    focus: "scan form interaction"
    actions:
      - type: "#scan-content" text: "Customer data: SIN: 123-456-789"
      - click: "#scan-btn"
      - wait: 3000
  - page: https://github.com/user/repo/issues/327
    focus: "self-healing evidence"

style:
  zoom: 1.35
  bg_color: "#080c12"
  accent_color: "#00aaff"
  font: "JetBrains Mono"

voiceover: true  # generate voiceover script with timestamps
```

#### Phase 3: Record (`autodemo record`)

Run the Playwright script:

```
Input:  record-demo.mjs
Output: segments/*.webm
```

Key implementation details:
- `chromium.launch({ headless: false })` — headed mode for smooth rendering
- `context.recordVideo({ dir, size: { width: 1920, height: 1080 } })` — VP8 webm
- Each segment = separate browser context (clean state, separate video file)
- Warm-up fetch before recording (avoid cold starts in video)
- `page.video().path()` before `page.close()`, then rename after `context.close()`

#### Phase 4: Composite (`autodemo compose`)

Stitch segments with ffmpeg:

```
Input:  segments/*.webm + style config
Output: demo.mp4
```

Steps:
1. Generate title/transition cards with `ffmpeg drawtext` using app's design tokens
2. Re-encode `.webm` → constant 30fps `.mp4` (Playwright webm is variable framerate)
3. Concat via ffmpeg demuxer
4. Add `-movflags +faststart` for web playback
5. Generate voiceover script with aligned timestamps

## How gh-aw Could Help

This is where it gets interesting. The discovery and scripting phases are perfect for an AI agent workflow.

### As a gh-aw Workflow

```yaml
# .github/workflows/generate-demo.yml
name: Generate Demo Video
on:
  workflow_dispatch:
    inputs:
      app_url:
        description: "Deployed app URL"
        required: true
      focus:
        description: "What to demo (optional — agent figures it out)"
        required: false

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Analyze codebase
        uses: github/gh-aw@v0.51
        with:
          task: |
            Analyze this codebase and create a page map for demo video generation.
            For each route, identify: interactive elements (forms, buttons),
            scroll-worthy sections, and the page's purpose.
            Output as pages.json.

      - name: Generate recording script
        uses: github/gh-aw@v0.51
        with:
          task: |
            Using pages.json, generate a Playwright recording script that
            creates a cinematic demo video. Include smooth scrolling,
            deliberate typing for form interactions, and logical segment ordering.
            The app is deployed at ${{ inputs.app_url }}.

      - name: Record and composite
        run: |
          npx playwright install chromium
          node record-demo.mjs
          bash compose.sh

      - uses: actions/upload-artifact@v4
        with:
          name: demo-video
          path: demo.mp4
```

### Agent Capabilities Needed

The gh-aw agent would need to:

1. **Read framework conventions** — detect Razor, Next.js, etc. and know where routes are defined
2. **Understand DOM structure** — parse HTML/JSX to find interactive elements
3. **Make UX judgments** — decide what's demo-worthy, what order to show things, what to type into forms
4. **Generate working Playwright code** — not just pseudocode, actual runnable scripts
5. **Extract design tokens** — pull colors/fonts from CSS for matching title cards

This is well within current agent capability. The codebase analysis is the same kind of work `repo-assist` already does — just oriented toward "what would make a good demo" instead of "what needs to be implemented."

### The Meta Angle

The tool itself could be built by gh-aw:
- Write a PRD issue describing `autodemo`
- Let the pipeline decompose it into implementation issues
- Agent builds the CLI, the framework analyzers, the Playwright generator
- The demo video for `autodemo` is generated by `autodemo`

## Key Technical Lessons from the prd-to-prod Build

### Playwright Video Recording
- Use `headless: false` — headless mode renders differently
- Video is VP8 `.webm` with variable framerate — MUST re-encode to constant framerate before concat
- `page.video().path()` must be called before `page.close()`
- `context.close()` finalizes the video file — rename after this
- Each segment needs its own browser context (video recording is per-context)

### CSS Zoom for Demo Readability
- `document.body.style.zoom = '1.35'` scales everything including layout reflow
- Better than `transform: scale()` which leaves dead space
- Better than smaller viewport which reduces recording resolution
- Calibrate zoom to the app's `max-width` — wider layouts need less zoom

### ffmpeg Compositing
- `drawtext` filter for title cards — use the app's own fonts and colors
- `-f concat -safe 0` for stitching — all inputs must match format/resolution/framerate
- `-movflags +faststart` — moves moov atom for progressive web playback
- `-crf 18` — visually lossless for screen content
- Variable framerate source + constant framerate target = must specify `-r 30` explicitly

### Cinematic Pacing
- `requestAnimationFrame` + ease-in-out quad for smooth scrolling (not `window.scrollTo({ behavior: 'smooth' })` which you can't control duration of)
- 25-40ms per-character typing delay for "someone is typing" effect
- 1-2.5s pauses between actions — long enough to read, short enough to not bore
- Hold final frame 1.5s before cutting

### Data Seeding
- Demo pages need data to look alive — seed before recording
- If the app reads from files (not a DB), those files need to be in the deploy package
- Use real data from actual system activity when possible (we used real pipeline run events)

## File Structure for the CLI

```
autodemo/
  bin/
    autodemo.mjs           — CLI entrypoint
  lib/
    analyze/
      index.mjs            — framework detection + dispatch
      razor.mjs            — ASP.NET Razor analyzer
      nextjs.mjs           — Next.js analyzer
      generic.mjs          — DOM-based fallback analyzer
    generate/
      script-generator.mjs — Playwright script generation
      card-generator.mjs   — ffmpeg title card generation
      voiceover.mjs        — voiceover script with timestamps
    record/
      recorder.mjs         — Playwright segment recording
      helpers.mjs          — smoothScroll, typeSlowly, zoomPage, dismissBanners
    compose/
      compositor.mjs       — ffmpeg re-encode + concat
    utils/
      design-tokens.mjs    — CSS custom property extraction
      fonts.mjs            — local font discovery
  templates/
    record-demo.mjs.ejs    — Playwright script template
    compose.sh.ejs         — ffmpeg script template
  package.json
  README.md
```

## MVP Scope

For a first version, skip the agent and build the CLI with manual hints:

1. `autodemo init` — scaffolds `autodemo.yml` with detected pages
2. User edits `autodemo.yml` to specify segments, actions, focus areas
3. `autodemo generate` — creates Playwright script + compose script from config
4. `autodemo record` — runs the Playwright script
5. `autodemo compose` — stitches final video
6. `autodemo all` — runs the full pipeline

The agent-powered version (Phase 2) replaces steps 1-3 with `autodemo auto` which uses an LLM to analyze the codebase and generate everything.
