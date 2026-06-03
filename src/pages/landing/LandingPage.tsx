import { Link } from 'react-router-dom'
import FeaturesSection from '@/components/landing/FeaturesSection'
import HeroCarousel from '@/components/landing/HeroCarousel'
import LandingFooter from '@/components/landing/LandingFooter'
import LandingHeader from '@/components/landing/LandingHeader'
import LandingLoansSection from '@/components/landing/LandingLoansSection'
import TestimonialsMarquee from '@/components/landing/TestimonialsMarquee'
import TrustedByMarquee from '@/components/landing/TrustedByMarquee'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingHeader />

      <main>
        <HeroCarousel />


        <TrustedByMarquee />

        <FeaturesSection />

        <LandingLoansSection />

        <section id="why-us" className="bg-accent/25 py-20 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary-dark mb-8">Why choose us</h2>
              <ul className="space-y-5">
                {['Unmatched Security', 'Lightning Fast Performance', 'Transparent Fee Structure'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-primary-dark font-medium">
                    <span className="w-2 h-2 rounded-full bg-primary-dark flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-primary-dark p-8 text-white shadow-xl">
              <div className="rounded-2xl bg-white/10 border border-white/20 p-5">
                <div className="flex justify-between mb-6">
                  <div className="w-12 h-8 bg-accent rounded-md" />
                  <span className="text-xs text-white/70">Debit</span>
                </div>
                <p className="text-2xl font-mono tracking-wider mb-1">•••• •••• •••• 4829</p>
                <p className="text-white/60 text-sm">Valid thru 08/28</p>
              </div>
            </div>
          </div>
        </section>

        <TestimonialsMarquee />

        <section id="contact" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20 border-t border-gray-100">
          <div className="rounded-2xl border border-gray-100 bg-surface p-8 text-center max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-primary-dark mb-2">We&apos;re here to help</h2>
            <p className="text-gray-600 text-sm mb-6">
              Questions about accounts or business banking? Reach out and we&apos;ll get back to you.
            </p>
            <Link
              to="/auth/signin"
              className="inline-flex justify-center bg-primary-dark text-white font-semibold px-6 py-2.5 rounded-full hover:bg-primary transition-colors text-sm"
            >
              Sign in for support
            </Link>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gradient-to-br from-accent/20 via-surface to-white py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-primary-dark sm:text-3xl">
                Ready to take control of your finances?
              </h2>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-accent-dark" aria-hidden>
                    ✓
                  </span>
                  No hidden fees on everyday banking
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-dark" aria-hidden>
                    ✓
                  </span>
                  FDIC-insured eligible deposits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-dark" aria-hidden>
                    ✓
                  </span>
                  Powerful mobile and web experience
                </li>
              </ul>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                to="/auth/signup"
                className="inline-flex justify-center rounded-full bg-primary-dark px-6 py-3 font-semibold text-white transition-colors hover:bg-primary"
              >
                Open Your Account
              </Link>
              <a
                href="#contact"
                className="inline-flex justify-center rounded-full border border-primary-dark/25 bg-white px-6 py-3 font-semibold text-primary-dark transition-colors hover:border-primary-dark/40 hover:bg-white/80"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
