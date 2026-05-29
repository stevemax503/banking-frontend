import { useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SafaPayLogo from '@/components/brand/SafaPayLogo'
import { LANDING_HEADER_BAR_HEIGHT_CLASS } from '@/components/landing/landingHeaderLayout'
import { cn } from '@/utils/cn'
import GoogleTranslateControl from '@/components/layout/GoogleTranslateControl'

const SCROLL_THRESHOLD_PX = 24

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#why-us', label: 'Why us' },
  { href: '#loans', label: 'Loans' },
  { href: '#contact', label: 'Support' },
] as const

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  // Match real scroll position before first paint (avoids wrong theme mid-page refresh).
  useLayoutEffect(() => {
    setScrolled(window.scrollY > SCROLL_THRESHOLD_PX)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD_PX)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onGlass = !scrolled

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ease-out',
        onGlass
          ? 'border-b border-white/15 bg-primary-dark/45 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-primary-dark/35'
          : 'border-b border-gray-200/80 bg-white/95 shadow-[0_1px_0_rgba(21,42,30,0.04),0_12px_40px_-12px_rgba(21,42,30,0.12)] backdrop-blur-xl',
      )}
    >
      <div
        className={cn(
          'mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-3 pl-2 pr-4 sm:gap-6 sm:pl-3 sm:pr-6',
          LANDING_HEADER_BAR_HEIGHT_CLASS,
        )}
      >
        <div className="-ml-1 min-w-0 shrink sm:-ml-1.5">
          <SafaPayLogo
            variant={onGlass ? 'light' : 'dark'}
            size="sm"
            taglineFrom="lg"
            className="min-w-0 md:hidden"
          />
          <SafaPayLogo
            variant={onGlass ? 'light' : 'dark'}
            size="md"
            taglineFrom="lg"
            className="hidden min-w-0 md:flex"
          />
        </div>

        <div className="flex min-w-0 flex-shrink-0 items-center gap-2 sm:gap-4 md:gap-8">
          <nav
            className="hidden items-center md:flex md:gap-1 lg:gap-1.5"
            aria-label="Page sections"
          >
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={cn(
                  'group relative whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200',
                  onGlass
                    ? 'text-white/85 hover:bg-white/10 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100/90 hover:text-primary-dark',
                )}
              >
                <span className="relative z-10">{label}</span>
                <span
                  className={cn(
                    'absolute inset-x-2 bottom-1.5 h-px origin-left scale-x-0 rounded-full transition-transform duration-200 ease-out group-hover:scale-x-100',
                    onGlass ? 'bg-accent' : 'bg-primary-dark',
                  )}
                  aria-hidden
                />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/auth/signin"
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 sm:px-4 sm:py-2.5 sm:text-sm',
                onGlass
                  ? 'border border-white/30 bg-white/5 text-white/95 hover:border-white/50 hover:bg-white/12'
                  : 'border border-gray-200 bg-white text-primary-dark hover:border-primary-light/40 hover:bg-surface',
              )}
            >
              Log in
            </Link>
            <Link
              to="/auth/signup"
              className={cn(
                'whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-5 sm:py-2.5 sm:text-sm',
                onGlass
                  ? 'bg-accent text-primary-dark shadow-primary-dark/20 hover:bg-accent-light hover:shadow-md'
                  : 'bg-primary-dark text-white hover:bg-primary hover:shadow-md',
              )}
            >
              Sign up
            </Link>
            <GoogleTranslateControl variant={onGlass ? 'onDark' : 'default'} />
          </div>
        </div>
      </div>
    </header>
  )
}
