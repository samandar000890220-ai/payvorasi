type ScrollTarget = Window | HTMLElement

type ScrollMetrics = {
  scrollTop: number
  viewportHeight: number
  scrollHeight: number
  maxScroll: number
}

const SCROLL_ROOT_SELECTOR = '[data-payvora-scrollbar-root]'
const MIN_THUMB_HEIGHT = 32
const AUTO_HIDE_DELAY = 1_400

function documentScrollHeight() {
  const body = document.body
  const root = document.documentElement

  return Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    root.scrollHeight,
    root.offsetHeight,
    root.clientHeight,
  )
}

function isWindowTarget(target: ScrollTarget): target is Window {
  return target === window
}

function getMetrics(target: ScrollTarget): ScrollMetrics {
  const viewportHeight = isWindowTarget(target) ? window.innerHeight : target.clientHeight
  const scrollHeight = isWindowTarget(target) ? documentScrollHeight() : target.scrollHeight
  const scrollTop = isWindowTarget(target) ? window.scrollY : target.scrollTop

  return {
    scrollTop,
    viewportHeight,
    scrollHeight,
    maxScroll: Math.max(0, scrollHeight - viewportHeight),
  }
}

function isScrollable(target: HTMLElement) {
  return target.isConnected && target.clientHeight > 0 && target.scrollHeight > target.clientHeight + 1
}

/**
 * Finds PAYVORA's primary native scroll surface. Document scrolling takes
 * precedence, so full-page routes always use window.scrollY/window.scrollTo.
 * The app shell otherwise exposes its central scroll pane with the data
 * attribute, avoiding accidental binding to menus, dialogs, or textareas.
 */
function getScrollTarget(): ScrollTarget | null {
  if (documentScrollHeight() > window.innerHeight + 1) return window

  const roots = Array.from(document.querySelectorAll<HTMLElement>(SCROLL_ROOT_SELECTOR))
  return roots.find(isScrollable) ?? roots.find(root => root.isConnected && root.clientHeight > 0) ?? null
}

function scrollTo(target: ScrollTarget, top: number) {
  const { maxScroll } = getMetrics(target)
  const clampedTop = Math.max(0, Math.min(maxScroll, top))

  // Keep this tied to the browser's real scroll position. PAYVORA's app shell
  // has a designated native scroll pane; document routes use window.scrollTo.
  if (isWindowTarget(target)) {
    window.scrollTo({ top: clampedTop, behavior: 'auto' })
  } else {
    target.scrollTo({ top: clampedTop, behavior: 'auto' })
  }
}

/**
 * Installs the global PAYVORA scrollbar. It mirrors an existing browser scroll
 * surface; it never creates a synthetic scrolling area or intercepts wheel,
 * touchpad, touch, or ordinary keyboard scrolling.
 */
export function initPayvoraScrollbar() {
  const scrollbar = document.createElement('div')
  const track = document.createElement('div')
  const thumb = document.createElement('div')

  scrollbar.className = 'payvora-scrollbar'
  scrollbar.setAttribute('role', 'scrollbar')
  scrollbar.setAttribute('aria-label', 'Page scroll position')
  scrollbar.setAttribute('aria-orientation', 'vertical')
  scrollbar.tabIndex = 0

  track.className = 'payvora-scrollbar-track'
  thumb.className = 'payvora-scrollbar-thumb'
  thumb.setAttribute('aria-hidden', 'true')

  track.appendChild(thumb)
  scrollbar.appendChild(track)
  document.body.appendChild(scrollbar)

  let activeTarget: ScrollTarget | null = null
  let activeResizeTarget: HTMLElement | null = null
  let animationFrame = 0
  let hideTimeout: number | undefined
  let dragging = false
  let pointerId: number | null = null
  let dragStartY = 0
  let dragStartScrollTop = 0

  const reveal = () => {
    if (!activeTarget || getMetrics(activeTarget).maxScroll <= 1) return
    scrollbar.classList.add('payvora-scrollbar--visible')
    window.clearTimeout(hideTimeout)
    hideTimeout = window.setTimeout(() => {
      if (!dragging && document.activeElement !== scrollbar) {
        scrollbar.classList.remove('payvora-scrollbar--visible')
      }
    }, AUTO_HIDE_DELAY)
  }

  const scheduleUpdate = () => {
    if (animationFrame) return
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0
      update()
    })
  }

  const resizeObserver = new ResizeObserver(scheduleUpdate)
  resizeObserver.observe(document.documentElement)
  resizeObserver.observe(document.body)

  const update = () => {
    const nextTarget = getScrollTarget()
    activeTarget = nextTarget

    if (activeResizeTarget && activeResizeTarget !== nextTarget) {
      resizeObserver.unobserve(activeResizeTarget)
      activeResizeTarget = null
    }
    if (nextTarget && !isWindowTarget(nextTarget) && activeResizeTarget !== nextTarget) {
      resizeObserver.observe(nextTarget)
      activeResizeTarget = nextTarget
      if (!nextTarget.id) nextTarget.id = 'payvora-scroll-root'
      scrollbar.setAttribute('aria-controls', nextTarget.id)
    } else if (nextTarget && isWindowTarget(nextTarget)) {
      scrollbar.removeAttribute('aria-controls')
    }

    if (!nextTarget) {
      scrollbar.classList.remove('payvora-scrollbar--scrollable', 'payvora-scrollbar--visible')
      return
    }

    const { scrollTop, viewportHeight, scrollHeight, maxScroll } = getMetrics(nextTarget)
    if (maxScroll <= 1 || viewportHeight <= 0 || scrollHeight <= 0) {
      scrollbar.classList.remove('payvora-scrollbar--scrollable', 'payvora-scrollbar--visible')
      return
    }

    const trackHeight = track.getBoundingClientRect().height || viewportHeight
    const thumbHeight = Math.min(
      trackHeight,
      Math.max(MIN_THUMB_HEIGHT, (viewportHeight / scrollHeight) * trackHeight),
    )
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0

    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${thumbTop}px)`
    scrollbar.classList.add('payvora-scrollbar--scrollable')
    scrollbar.setAttribute('aria-valuemin', '0')
    scrollbar.setAttribute('aria-valuemax', String(Math.round(maxScroll)))
    scrollbar.setAttribute('aria-valuenow', String(Math.round(scrollTop)))
  }

  const onScroll = () => {
    scheduleUpdate()
    reveal()
  }

  const endDrag = () => {
    if (!dragging) return
    dragging = false
    pointerId = null
    thumb.classList.remove('payvora-scrollbar-thumb--dragging')
    document.documentElement.classList.remove('payvora-scrollbar-dragging')
    reveal()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || pointerId !== event.pointerId || !activeTarget) return

    const { maxScroll } = getMetrics(activeTarget)
    const trackHeight = track.getBoundingClientRect().height
    const thumbHeight = thumb.getBoundingClientRect().height
    const availableTrack = trackHeight - thumbHeight
    if (availableTrack <= 0 || maxScroll <= 0) return

    const scrollDelta = ((event.clientY - dragStartY) / availableTrack) * maxScroll
    scrollTo(activeTarget, dragStartScrollTop + scrollDelta)
  }

  const onThumbPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !activeTarget) return

    event.preventDefault()
    event.stopPropagation()
    dragging = true
    pointerId = event.pointerId
    dragStartY = event.clientY
    dragStartScrollTop = getMetrics(activeTarget).scrollTop
    thumb.setPointerCapture?.(event.pointerId)
    thumb.classList.add('payvora-scrollbar-thumb--dragging')
    document.documentElement.classList.add('payvora-scrollbar-dragging')
    reveal()
  }

  const onTrackPointerDown = (event: PointerEvent) => {
    if (event.target === thumb || event.button !== 0 || !activeTarget) return

    event.preventDefault()
    const trackRect = track.getBoundingClientRect()
    const thumbHeight = thumb.getBoundingClientRect().height
    const availableTrack = trackRect.height - thumbHeight
    const { maxScroll } = getMetrics(activeTarget)
    if (availableTrack <= 0 || maxScroll <= 0) return

    const nextThumbTop = Math.max(0, Math.min(availableTrack, event.clientY - trackRect.top - thumbHeight / 2))
    scrollTo(activeTarget, (nextThumbTop / availableTrack) * maxScroll)
    reveal()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!activeTarget) return

    const { scrollTop, viewportHeight, maxScroll } = getMetrics(activeTarget)
    const keyboardStep = Math.max(40, viewportHeight * 0.1)
    let nextTop: number | null = null

    switch (event.key) {
      case 'ArrowDown': nextTop = scrollTop + keyboardStep; break
      case 'ArrowUp': nextTop = scrollTop - keyboardStep; break
      case 'PageDown': nextTop = scrollTop + viewportHeight * 0.9; break
      case 'PageUp': nextTop = scrollTop - viewportHeight * 0.9; break
      case 'Home': nextTop = 0; break
      case 'End': nextTop = maxScroll; break
      default: return
    }

    event.preventDefault()
    scrollTo(activeTarget, nextTop)
    reveal()
  }

  const mutationObserver = new MutationObserver(mutations => {
    // Styling the injected scrollbar triggers attribute mutations too; ignore
    // those so the observer never schedules a self-sustaining update loop.
    if (mutations.some(mutation => !scrollbar.contains(mutation.target))) scheduleUpdate()
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true })

  thumb.addEventListener('pointerdown', onThumbPointerDown)
  track.addEventListener('pointerdown', onTrackPointerDown)
  thumb.addEventListener('pointermove', onPointerMove)
  thumb.addEventListener('pointerup', endDrag)
  thumb.addEventListener('pointercancel', endDrag)
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  scrollbar.addEventListener('keydown', onKeyDown)
  scrollbar.addEventListener('focus', reveal)
  scrollbar.addEventListener('mouseenter', reveal)
  scrollbar.addEventListener('mouseleave', () => { if (!dragging) reveal() })

  update()

  return () => {
    window.clearTimeout(hideTimeout)
    window.cancelAnimationFrame(animationFrame)
    mutationObserver.disconnect()
    resizeObserver.disconnect()
    thumb.removeEventListener('pointerdown', onThumbPointerDown)
    track.removeEventListener('pointerdown', onTrackPointerDown)
    thumb.removeEventListener('pointermove', onPointerMove)
    thumb.removeEventListener('pointerup', endDrag)
    thumb.removeEventListener('pointercancel', endDrag)
    document.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', scheduleUpdate)
    scrollbar.removeEventListener('keydown', onKeyDown)
    scrollbar.removeEventListener('focus', reveal)
    scrollbar.removeEventListener('mouseenter', reveal)
    document.documentElement.classList.remove('payvora-scrollbar-dragging')
    scrollbar.remove()
  }
}
