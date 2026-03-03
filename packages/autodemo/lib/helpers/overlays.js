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
