export async function typeSlowly(page, selector, text, { delay = 35 } = {}) {
  await page.click(selector)
  await page.type(selector, text, { delay })
}
