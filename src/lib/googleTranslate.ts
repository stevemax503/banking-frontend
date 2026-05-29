const ELEMENT_ID = 'google_translate_element'
const SCRIPT_ID = 'google-translate-script'
const COOKIE_NAME = 'googtrans'
const PAGE_LANGUAGE = 'en'

export const TRANSLATE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const

export const DEFAULT_INCLUDED_LANGUAGES = TRANSLATE_LANGUAGES.map((l) => l.code).join(',')

let loadPromise: Promise<void> | null = null
let initialized = false

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: {
      translate: {
        TranslateElement: {
          new (options: Record<string, unknown>, elementId: string): void
          InlineLayout: { SIMPLE: number }
        }
      }
    }
  }
}

export function isGoogleTranslateEnabled(): boolean {
  const flag = import.meta.env.VITE_GOOGLE_TRANSLATE_ENABLED
  if (flag === 'false' || flag === '0') return false
  return true
}

function cookieDomains(): string[] {
  const host = window.location.hostname
  const domains = new Set<string>([''])
  if (host && host !== 'localhost') {
    domains.add(host)
    const parts = host.split('.')
    if (parts.length >= 2) {
      domains.add(`.${parts.slice(-2).join('.')}`)
    }
  }
  return [...domains]
}

function writeCookie(value: string | null) {
  const expires =
    value === null
      ? 'Thu, 01 Jan 1970 00:00:00 UTC'
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()

  for (const domain of cookieDomains()) {
    const domainPart = domain ? `;domain=${domain}` : ''
    if (value === null) {
      document.cookie = `${COOKIE_NAME}=;expires=${expires};path=/${domainPart}`
    } else {
      document.cookie = `${COOKIE_NAME}=${value};expires=${expires};path=/${domainPart}`
    }
  }
}

export function getActiveTranslateLanguage(): string {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/)
  if (!match) return 'en'

  const parts = decodeURIComponent(match[1]).split('/').filter(Boolean)
  const target = parts[parts.length - 1]
  if (!target || target === PAGE_LANGUAGE) return 'en'
  return target
}

/** Set Google Translate cookie and reload — reliable for React SPAs. */
export function applyGoogleTranslateLanguage(langCode: string): void {
  if (langCode === 'en') {
    writeCookie(null)
  } else {
    writeCookie(`/${PAGE_LANGUAGE}/${langCode}`)
  }

  window.location.reload()
}

export function getGoogleTranslateCombo(): HTMLSelectElement | null {
  return document.querySelector('.goog-te-combo') as HTMLSelectElement | null
}

export function waitForGoogleTranslateReady(timeoutMs = 15000): Promise<void> {
  return loadGoogleTranslate().then(
    () =>
      new Promise((resolve, reject) => {
        const started = Date.now()
        const tick = () => {
          if (getGoogleTranslateCombo()) {
            resolve()
            return
          }
          if (Date.now() - started > timeoutMs) {
            reject(new Error('Google Translate not ready'))
            return
          }
          window.setTimeout(tick, 80)
        }
        tick()
      }),
  )
}

/** Loads Google's script once; UI is fully custom (hidden off-screen). */
export function loadGoogleTranslate(
  config: { pageLanguage?: string; includedLanguages?: string } = {},
): Promise<void> {
  if (typeof window === 'undefined' || !isGoogleTranslateEnabled()) {
    return Promise.resolve()
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    const init = () => {
      try {
        if (initialized) {
          resolve()
          return
        }

        const TranslateElement = window.google?.translate?.TranslateElement
        if (!TranslateElement) {
          reject(new Error('Google Translate API not available'))
          return
        }

        if (!document.getElementById(ELEMENT_ID)) {
          reject(new Error('Google Translate container missing'))
          return
        }

        const layout = TranslateElement.InlineLayout?.SIMPLE

        new TranslateElement(
          {
            pageLanguage: config.pageLanguage ?? PAGE_LANGUAGE,
            includedLanguages: config.includedLanguages ?? DEFAULT_INCLUDED_LANGUAGES,
            autoDisplay: false,
            multilanguagePage: true,
            ...(layout !== undefined ? { layout } : {}),
          },
          ELEMENT_ID,
        )
        initialized = true
        resolve()
      } catch (err) {
        loadPromise = null
        reject(err)
      }
    }

    if (document.getElementById(SCRIPT_ID)) {
      init()
      return
    }

    window.googleTranslateElementInit = init

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    script.async = true
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Google Translate'))
    }
    document.body.appendChild(script)
  })

  return loadPromise
}

export const GOOGLE_TRANSLATE_ELEMENT_ID = ELEMENT_ID
