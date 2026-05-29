export const TAWK_PROPERTY_ID =
  (import.meta.env.VITE_TAWK_PROPERTY_ID || '').trim() || '6a19a97f2951b91c34153174'
export const TAWK_WIDGET_ID =
  (import.meta.env.VITE_TAWK_WIDGET_ID || '').trim() || '1jpq3s7dj'

const TAWK_SCRIPT_SRC = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`

let loadPromise: Promise<void> | null = null

function isTawkEnabled(): boolean {
  const flag = import.meta.env.VITE_TAWK_ENABLED
  if (flag === 'false' || flag === '0') return false
  return true
}

function tawkScriptSelector() {
  return `script[src*="embed.tawk.to/${TAWK_PROPERTY_ID}"]`
}

function isTawkReady() {
  return typeof window.Tawk_API?.maximize === 'function'
}

function injectTawkScript() {
  if (document.querySelector(tawkScriptSelector())) return

  window.Tawk_API = window.Tawk_API || {}
  window.Tawk_LoadStart = window.Tawk_LoadStart || new Date()

  const script = document.createElement('script')
  script.async = true
  script.src = TAWK_SCRIPT_SRC
  script.charset = 'UTF-8'
  script.setAttribute('crossorigin', '*')
  document.body.appendChild(script)
}

/** Wait for Tawk widget API (script is injected from index.html at build time). */
export function loadTawk(): Promise<void> {
  if (typeof window === 'undefined' || !isTawkEnabled()) return Promise.resolve()
  if (isTawkReady()) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    window.Tawk_API = window.Tawk_API || {}

    const previousOnLoad = window.Tawk_API.onLoad
    window.Tawk_API.onLoad = function tawkOnLoad() {
      window.Tawk_API?.showWidget?.()
      previousOnLoad?.()
      finish()
    }

    if (!document.querySelector(tawkScriptSelector())) {
      injectTawkScript()
    }

    const poll = window.setInterval(() => {
      if (isTawkReady()) {
        window.clearInterval(poll)
        finish()
      }
    }, 250)

    window.setTimeout(() => {
      window.clearInterval(poll)
      finish()
    }, 15_000)
  })

  return loadPromise
}

export async function openTawkChat(): Promise<void> {
  await loadTawk()
  if (!isTawkReady()) return
  window.Tawk_API!.maximize!()
}

export async function setTawkVisitorAttributes(attrs: {
  name?: string
  email?: string
}): Promise<void> {
  await loadTawk()
  if (!window.Tawk_API?.setAttributes) return

  window.Tawk_API.setAttributes(
    {
      name: attrs.name || '',
      email: attrs.email || '',
    },
    () => {},
  )
}
