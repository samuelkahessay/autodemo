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
