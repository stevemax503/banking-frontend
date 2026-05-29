export const TAWK_PROPERTY_ID =
  import.meta.env.VITE_TAWK_PROPERTY_ID || '6a19a97f2951b91c34153174'
export const TAWK_WIDGET_ID = import.meta.env.VITE_TAWK_WIDGET_ID || '1jpq3s7dj'

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
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = new Date()

    const previousOnLoad = window.Tawk_API.onLoad
    window.Tawk_API.onLoad = function tawkOnLoad() {
      previousOnLoad?.()
      resolve()
    }

    if (existingScript) return

    const script = document.createElement('script')
    const firstScript = document.getElementsByTagName('script')[0]
    script.async = true
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`
    script.charset = 'UTF-8'
    script.setAttribute('crossorigin', '*')
    firstScript?.parentNode?.insertBefore(script, firstScript)
  })

  return loadPromise
}

export async function openTawkChat(): Promise<void> {
  await loadTawk()
  window.Tawk_API?.maximize?.()
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
      if (error) console.warn('Tawk visitor attributes failed', error)
    },
  )
}
