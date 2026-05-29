import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HERO_SLIDES, heroImageUrl } from '@/data/heroSlides'
import {
  LANDING_HERO_UNDER_HEADER_CLASS,
} from '@/components/landing/landingHeaderLayout'
import { cn } from '@/utils/cn'

const AUTO_MS = 5000
const SLIDE_COUNT = HERO_SLIDES.length

function HeroSlidePanel({
  slide,
  active,
  direction,
  transitionKey,
  prefersReducedMotion,
}: {
  slide: (typeof HERO_SLIDES)[number]
  active: boolean
  direction: number
  transitionKey: number
  prefersReducedMotion: boolean
}) {
  const [imageOk, setImageOk] = useState(true)
  const isInternal = slide.ctaHref.startsWith('/') && !slide.ctaHref.startsWith('//')
  const ctaClass =
    'inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-primary-dark transition-all duration-300 hover:scale-105 hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark'

  const enterStyle: CSSProperties | undefined =
    !prefersReducedMotion && active
      ? ({ '--hero-enter-x': `${direction * 48}px` } as CSSProperties)
      : undefined

  return (
    <div
      className={cn(
        'absolute inset-0 transition-[opacity,transform,filter] duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)]',
        active ? 'z-10 opacity-100' : 'z-0 pointer-events-none opacity-0',
        !prefersReducedMotion && active && 'animate-hero-slide-in',
        !prefersReducedMotion && !active && 'scale-105 blur-[2px]',
      )}
      style={enterStyle}
      aria-hidden={!active}
    >
      <div className="absolute inset-0 overflow-hidden">
        {imageOk ? (
          <img
            src={heroImageUrl(slide.imageFile)}
            alt=""
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              active && !prefersReducedMotion && 'animate-hero-ken-burns',
            )}
            onError={() => setImageOk(false)}
          />
        ) : (
          <div
            className="absolute inset-0 animate-hero-gradient-shift bg-gradient-to-br from-primary-dark via-primary to-primary-light"
            aria-hidden
          />
        )}
        {active && !prefersReducedMotion ? (
          <div
            className="pointer-events-none absolute inset-0 animate-hero-shimmer-sweep bg-gradient-to-r from-transparent via-white/20 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>

      <div
        className="absolute inset-0 bg-gradient-to-r from-primary-dark/92 via-primary-dark/75 to-primary-dark/20 sm:to-primary-dark/5"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/60 via-primary-dark/10 to-transparent" aria-hidden />

      <div className="relative z-10 flex h-full items-end">
        {active ? (
          <div
            key={transitionKey}
            className="mx-auto w-full max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 md:pb-20"
          >
            <p
              className={cn(
                'text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm',
                !prefersReducedMotion && 'animate-hero-text-in opacity-0',
              )}
              style={!prefersReducedMotion ? { animationDelay: '0.08s' } : undefined}
            >
              {slide.eyebrow}
            </p>
            <h1
              className={cn(
                'mt-3 max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem]',
                !prefersReducedMotion && 'animate-hero-text-in opacity-0',
              )}
              style={!prefersReducedMotion ? { animationDelay: '0.2s' } : undefined}
            >
              {slide.headline}
            </h1>
            <p
              className={cn(
                'mt-4 max-w-xl text-base text-white/85 sm:text-lg',
                !prefersReducedMotion && 'animate-hero-text-in opacity-0',
              )}
              style={!prefersReducedMotion ? { animationDelay: '0.34s' } : undefined}
            >
              {slide.description}
            </p>
            <div
              className={cn(
                'mt-8 flex flex-wrap gap-3',
                !prefersReducedMotion && 'animate-hero-text-in opacity-0',
              )}
              style={!prefersReducedMotion ? { animationDelay: '0.48s' } : undefined}
            >
              {isInternal ? (
                <Link to={slide.ctaHref} className={ctaClass}>
                  {slide.ctaLabel}
                </Link>
              ) : (
                <a href={slide.ctaHref} className={ctaClass}>
                  {slide.ctaLabel}
                </a>
              )}
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:border-white/70 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                View features
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const touchStart = useRef<number | null>(null)

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => {
        const next = (current + delta + SLIDE_COUNT) % SLIDE_COUNT
        setDirection(delta > 0 ? 1 : -1)
        return next
      })
    },
    [],
  )

  const goTo = useCallback((target: number) => {
    setIndex((current) => {
      if (target === current) return current
      setDirection(target > current ? 1 : -1)
      return target
    })
  }, [])

  const next = useCallback(() => go(1), [go])
  const prev = useCallback(() => go(-1), [go])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (paused || prefersReducedMotion) return
    const id = window.setInterval(() => {
      setIndex((i) => {
        setDirection(1)
        return (i + 1) % SLIDE_COUNT
      })
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [paused, prefersReducedMotion])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  return (
    <section
      className={cn(
        'relative min-h-[min(88vh,720px)] w-full overflow-hidden bg-primary-dark',
        LANDING_HERO_UNDER_HEADER_CLASS,
      )}
      aria-roledescription="carousel"
      aria-label="Hero highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        if (touchStart.current == null) return
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current
        if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
        touchStart.current = null
      }}
    >
      {!prefersReducedMotion ? (
        <>
          <div
            className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 animate-hero-orb-float rounded-full bg-accent/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 bottom-1/4 h-80 w-80 animate-hero-orb-float-delayed rounded-full bg-primary-light/20 blur-3xl"
            aria-hidden
          />
        </>
      ) : null}

      {HERO_SLIDES.map((slide, i) => (
        <HeroSlidePanel
          key={slide.id}
          slide={slide}
          active={i === index}
          direction={direction}
          transitionKey={index}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pb-6 sm:pb-8">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-primary-dark/55 px-3 py-2.5 backdrop-blur-md">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                'relative h-2.5 overflow-hidden rounded-full transition-all duration-500',
                i === index ? 'w-10 bg-white/25' : 'w-2.5 bg-white/40 hover:bg-white/65',
              )}
              aria-label={`Go to slide ${i + 1}: ${slide.headline}`}
              aria-current={i === index}
            >
              {i === index && !prefersReducedMotion ? (
                <span
                  key={`dot-${index}-${paused}`}
                  className="animate-hero-progress absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent"
                  style={{ animationDuration: paused ? '0ms' : `${AUTO_MS}ms` }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={prev}
        className="animate-hero-arrow-pulse-left absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/25 bg-primary-dark/45 p-2.5 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-accent/50 hover:bg-primary-dark/75 sm:left-5 md:flex"
        aria-label="Previous slide"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={next}
        className="animate-hero-arrow-pulse-right absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/25 bg-primary-dark/45 p-2.5 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-accent/50 hover:bg-primary-dark/75 sm:right-5 md:flex"
        aria-label="Next slide"
      >
        <ChevronRight size={22} />
      </button>
    </section>
  )
}
