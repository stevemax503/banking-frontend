import type { LucideIcon } from 'lucide-react'
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react'

export type FooterLinkColumn = {
  title: string
  links: { label: string; href: string }[]
}

/** Only destinations that exist on the landing site or auth routes. */
export const FOOTER_COLUMNS: FooterLinkColumn[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Loans', href: '#loans' },
      { label: 'Why choose us', href: '#why-us' },
    ],
  },
  {
    title: 'Support',
    links: [{ label: 'Contact', href: '#contact' }],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Open account', href: '/auth/signup' },
      { label: 'Log in', href: '/auth/signin' },
    ],
  },
]

export type SocialLink = {
  id: string
  label: string
  icon: LucideIcon
}

/** Decorative icons only — no outbound links until profiles are published. */
export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'twitter', label: 'X (Twitter)', icon: Twitter },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
]

export const FOOTER_CONTACT = {
  email: 'support@safapaygroup.com',
  phone: '1-800-SAFA-PAY',
  tagline: 'Global operations · Digital-first banking',
} as const
