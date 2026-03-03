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
