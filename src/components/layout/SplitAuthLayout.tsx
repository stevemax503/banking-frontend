import { Lock, ShieldCheck, Sparkles } from 'lucide-react'
import AuthAnimatedTagline from '@/components/auth/AuthAnimatedTagline'
import SafaPayLogo from '@/components/brand/SafaPayLogo'
import GoogleTranslateControl from '@/components/layout/GoogleTranslateControl'
import { BANK_NAME } from '@/lib/brand'

interface SplitAuthLayoutProps {
  children: React.ReactNode
  /** Lock to viewport height — no page scroll; form panel can use full width. */
  fitViewport?: boolean
}

export default function SplitAuthLayout({ children, fitViewport = false }: SplitAuthLayoutProps) {
  return (
    <div
      className={
        fitViewport
          ? 'flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-surface'
          : 'flex min-h-screen bg-surface'
      }
    >
      {/* Brand panel */}
      <div className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light p-10 xl:p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_20%_0%,rgba(200,240,0,0.14),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden>
          <div className="absolute left-[8%] top-[18%] h-36 w-36 rotate-12 rounded-3xl border border-white/30" />
          <div className="absolute bottom-[22%] right-[6%] h-28 w-28 -rotate-6 rounded-3xl border border-white/25" />
          <div className="absolute right-[28%] top-[42%] h-16 w-16 rotate-45 rounded-2xl border border-accent/30" />
        </div>

        <SafaPayLogo variant="light" size="lg" showTagline={false} className="relative z-10" />

        <div
          className={
            fitViewport
              ? 'relative z-10 flex flex-1 items-center justify-center py-6'
              : 'relative z-10 flex flex-1 items-center justify-center py-10'
          }
        >
          <div className="relative w-full max-w-[280px]">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="flex items-start justify-between">
                <div className="h-9 w-12 rounded-md bg-gradient-to-br from-accent to-accent-dark shadow-inner" />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                </div>
              </div>
              <div className="mt-8 space-y-2.5">
                <div className="h-2.5 rounded-full bg-white/35" />
                <div className="h-2.5 w-4/5 rounded-full bg-white/25" />
                <div className="h-2.5 w-3/5 rounded-full bg-white/20" />
              </div>
              <p className="mt-6 font-mono text-sm tracking-[0.2em] text-white/90">•••• •••• •••• 4829</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">Valid thru 08/28</p>
            </div>
            <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent shadow-lg ring-2 ring-primary-dark/20">
              <ShieldCheck className="h-5 w-5 text-primary-dark" strokeWidth={2} aria-hidden />
            </div>
            <div className="absolute -bottom-3 -left-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm">
              <Lock className="h-5 w-5 text-white/90" strokeWidth={2} aria-hidden />
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <AuthAnimatedTagline className="auth-tagline-animated text-base xl:text-lg" />
          <p className="text-[11px] text-white/40">
            © {new Date().getFullYear()} {BANK_NAME}. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div
        className={
          fitViewport
            ? 'relative flex h-full min-h-0 flex-1 flex-col justify-center overflow-y-auto bg-gradient-to-b from-surface via-white to-surface px-5 py-6 sm:px-8 lg:px-10 xl:px-14'
            : 'relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-b from-surface via-white to-surface px-5 py-10 sm:px-8 lg:px-14 xl:px-20'
        }
      >
        <div
          className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-primary-dark/[0.04] blur-2xl"
          aria-hidden
        />

        <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
          <GoogleTranslateControl />
        </div>

        {!fitViewport ? (
          <SafaPayLogo
            variant="dark"
            size="md"
            showTagline={false}
            className="relative z-10 mb-8 lg:hidden"
          />
        ) : null}

        <div
          className={
            fitViewport
              ? 'relative z-10 mx-auto w-full min-h-0 max-w-[640px] lg:max-w-[680px]'
              : 'relative z-10 mx-auto w-full max-w-[440px]'
          }
        >
          {children}
        </div>

        <div
          className={
            fitViewport
              ? 'relative z-10 mx-auto mt-6 w-full max-w-[640px] space-y-3 text-center lg:hidden'
              : 'relative z-10 mx-auto mt-8 w-full max-w-[440px] space-y-3 text-center lg:hidden'
          }
        >
          {/* Intentionally blank on mobile (no tagline/copyright footer). */}
        </div>
      </div>
    </div>
  )
}
