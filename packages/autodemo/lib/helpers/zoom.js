export async function zoomPage(page, factor = 1.35) {
  await page.evaluate((f) => {
    document.body.style.zoom = String(f)
  }, factor)
}
