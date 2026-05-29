export const TAWK_PROPERTY_ID =
  (import.meta.env.VITE_TAWK_PROPERTY_ID || '').trim() || '6a19a97f2951b91c34153174'
export const TAWK_WIDGET_ID =
  (import.meta.env.VITE_TAWK_WIDGET_ID || '').trim() || '1jpq3s7dj'

const TAWK_SCRIPT_SRC = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`

let loadPromise: Promise<void> | null = null

function tawkScriptSelector() {
  return `script[src*="embed.tawk.to/${TAWK_PROPERTY_ID}"]`
}

export function loadTawk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Tawk_API?.maximize) return Promise.resolve()

  const existingScript = document.querySelector(tawkScriptSelector())
  if (existingScript && window.Tawk_API?.onLoad) {
    return loadPromise ?? Promise.resolve()
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    const previousOnLoad = window.Tawk_API.onLoad
    window.Tawk_API.onLoad = function tawkOnLoad() {
      previousOnLoad?.()
      finish()
    }

    if (existingScript) {
      window.setTimeout(finish, 0)
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = TAWK_SCRIPT_SRC
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', 'anonymous')
    script.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn('[Tawk] Failed to load embed script:', TAWK_SCRIPT_SRC)
      }
      finish()
    }
    document.body.appendChild(script)

    // Do not block the app if Tawk never calls onLoad (e.g. domain not whitelisted).
    window.setTimeout(finish, 12_000)
  })

  return loadPromise
}

export async function openTawkChat(): Promise<void> {
  await loadTawk()
  if (!window.Tawk_API?.maximize) {
    if (import.meta.env.DEV) {
      console.warn('[Tawk] Widget API unavailable — check Tawk dashboard domain settings.')
    }
    return
  }
  window.Tawk_API.maximize()
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
    (error) => {
      if (error && import.meta.env.DEV) {
        console.warn('[Tawk] Visitor attributes failed', error)
      }
    },
  )
}
