export async function smoothScroll(page, { to, duration = 1500, easing = 'easeInOutQuad' }) {
  await page.evaluate(({ to, duration, easing }) => {
    return new Promise((resolve) => {
      const target = typeof to === 'number'
        ? to
        : document.querySelector(to)?.getBoundingClientRect().top + window.scrollY

      if (target == null) { resolve(); return }

      const start = window.scrollY
      const distance = target - start
      const startTime = performance.now()

      const easings = {
        easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        linear: (t) => t,
      }
      const easeFn = easings[easing] || easings.easeInOutQuad

      function step(now) {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        window.scrollTo(0, start + distance * easeFn(progress))
        if (progress < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { to, duration, easing })
}
