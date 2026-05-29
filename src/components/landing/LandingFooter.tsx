import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import SafaPayLogo from '@/components/brand/SafaPayLogo'
import {
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  SOCIAL_LINKS,
} from '@/data/footerLinks'
import { BANK_NAME, BANK_TAGLINE } from '@/lib/brand'
import { cn } from '@/utils/cn'

function FooterNavLink({ href, label }: { href: string; label: string }) {
  const className = 'text-sm text-white/75 transition-colors hover:text-accent'

  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <a href={href} className={className}>
      {label}
    </a>
  )
}

export default function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative bg-primary-dark text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_80%_at_100%_50%,rgba(45,80,64,0.45),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-1/3 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,transparent,transparent_12px,rgba(255,255,255,0.5)_12px,rgba(255,255,255,0.5)_13px)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-10 pb-0 sm:px-6 sm:pt-12">
        <div className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SafaPayLogo variant="light" size="md" showTagline={false} className="justify-start" />
            <p className="mt-2 font-display text-sm italic tracking-[0.18em] text-accent">{BANK_TAGLINE}</p>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-white/55 sm:text-right sm:text-sm">
            Modern banking built on transparency, security, and an experience you can trust every day.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 pl-5 sm:pl-0 sm:grid-cols-3 sm:gap-10 lg:gap-16">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white">
                {column.title}
              </p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterNavLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-action-trapezium sm:mt-10">
          <div className="footer-action-trapezium__panel flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              {FOOTER_CONTACT.phone}
            </span>
            <span className="hidden h-4 w-px bg-white/25 sm:inline" aria-hidden />
            <a
              href={`mailto:${FOOTER_CONTACT.email}`}
              className="flex items-center gap-2 transition-colors hover:text-accent"
            >
              <Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              {FOOTER_CONTACT.email}
            </a>
          </div>

          <p className="text-center text-xs text-white/60 sm:max-w-[14rem] sm:text-sm lg:max-w-xs">
            {FOOTER_CONTACT.tagline}
          </p>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">We&apos;re social</p>
            <ul className="flex flex-wrap justify-center gap-2 sm:justify-end">
              {SOCIAL_LINKS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <span
                    className={cn(
                      'flex h-9 w-9 cursor-default items-center justify-center rounded-md border border-white/30 text-white/90',
                    )}
                    title={label}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </div>
      </div>

      <div className="relative mt-8 border-t border-white/10 bg-white text-primary-dark">
        <div className="mx-auto max-w-6xl px-6 py-4 text-center sm:px-6">
          <p className="text-xs leading-relaxed text-gray-600">
            © {year} {BANK_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
