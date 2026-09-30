'use client'

import { useEffect } from 'react'

export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement
    let frame = 0
    const update = () => {
      // iOS moves/resizes the visual viewport without resizing fixed-position layout.
      // Leave browser pinch zoom alone; it is not a keyboard resize.
      const mobile = window.matchMedia('(max-width: 1023px)').matches && Math.abs(viewport.scale - 1) < 0.05
      const height = mobile ? viewport.height : window.innerHeight
      const top = mobile ? viewport.offsetTop : 0
      const bottom = mobile ? Math.max(0, window.innerHeight - height - top) : 0
      root.style.setProperty('--visible-viewport-height', `${height}px`)
      root.style.setProperty('--visible-viewport-top', `${top}px`)
      root.style.setProperty('--visible-viewport-bottom', `${bottom}px`)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('pageshow', schedule)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pageshow', schedule)
      for (const property of ['height', 'top', 'bottom']) root.style.removeProperty(`--visible-viewport-${property}`)
    }
  }, [])
}
