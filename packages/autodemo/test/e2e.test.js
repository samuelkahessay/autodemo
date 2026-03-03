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
  .content { margin-top: 200vh; }
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
