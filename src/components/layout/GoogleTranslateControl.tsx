import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { selectShell } from '@/components/forms/StyledSelect'
import {
  TRANSLATE_LANGUAGES,
  applyGoogleTranslateLanguage,
  getActiveTranslateLanguage,
  isGoogleTranslateEnabled,
  loadGoogleTranslate,
} from '@/lib/googleTranslate'
import { cn } from '@/utils/cn'

type Variant = 'default' | 'onDark'

type Props = {
  className?: string
  variant?: Variant
}

function languageLabel(code: string) {
  return TRANSLATE_LANGUAGES.find((l) => l.code === code)?.label ?? 'English'
}

export default function GoogleTranslateControl({ className, variant = 'default' }: Props) {
  const [lang, setLang] = useState(() => getActiveTranslateLanguage())
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setLang(getActiveTranslateLanguage())
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const btn = buttonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const width = Math.max(rect.width, 168)
      const left = Math.min(rect.right - width, window.innerWidth - width - 8)
      setMenuStyle({
        top: rect.bottom + 6,
        left: Math.max(8, left),
        width,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if ((target as Element).closest?.('[data-google-translate-menu]')) return
      setOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!isGoogleTranslateEnabled()) return null

  const onDark = variant === 'onDark'

  const pickLanguage = (code: string) => {
    setOpen(false)
    if (code === lang) return
    setLang(code)
    applyGoogleTranslateLanguage(code)
  }

  const menu =
    open && menuStyle
      ? createPortal(
          <div
            data-google-translate-menu
            className="fixed z-[200] overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-[0_16px_40px_-12px_rgba(21,42,30,0.22)]"
            style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            role="listbox"
            aria-label="Select page language"
          >
            <ul className="max-h-[min(16rem,50dvh)] overflow-y-auto overscroll-contain py-1">
              {TRANSLATE_LANGUAGES.map(({ code, label }) => {
                const selected = lang === code
                return (
                  <li key={code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pickLanguage(code)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                        selected
                          ? 'bg-primary-dark/5 font-semibold text-primary-dark'
                          : 'text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      <span className="min-w-0 truncate">{label}</span>
                      {selected ? <Check size={14} className="shrink-0 text-primary-dark" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          'relative z-20 inline-flex min-w-0 max-w-[9.5rem] items-center gap-1.5 sm:max-w-[10.5rem]',
          className,
        )}
      >
        <Globe
          size={14}
          strokeWidth={2}
          className={cn('shrink-0', onDark ? 'text-white/70' : 'text-gray-400')}
          aria-hidden
        />
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Page language: ${languageLabel(lang)}`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            selectShell,
            'flex min-w-0 flex-1 items-center justify-between gap-1 px-2 py-1.5 text-left sm:px-2.5 sm:py-2',
            onDark && 'border-white/25 bg-white/10 hover:border-white/40',
          )}
        >
          <span
            className={cn(
              'truncate text-xs font-medium sm:text-sm',
              onDark ? 'text-white' : 'text-gray-800',
            )}
          >
            {languageLabel(lang)}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              'shrink-0 transition-transform',
              onDark ? 'text-white/60' : 'text-gray-400',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </div>
      {menu}
    </>
  )
}

/** Hidden mount point + script bootstrap (render once in App). */
export function GoogleTranslateBootstrap() {
  useEffect(() => {
    if (!isGoogleTranslateEnabled()) return
    void loadGoogleTranslate().catch(() => {})
  }, [])

  if (!isGoogleTranslateEnabled()) return null

  return (
    <div id="google_translate_element" className="google-translate-hidden" aria-hidden="true" />
  )
}
