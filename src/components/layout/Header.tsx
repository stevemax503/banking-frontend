import { Menu } from 'lucide-react'
import GoogleTranslateControl from '@/components/layout/GoogleTranslateControl'

interface HeaderProps {
  /** Opens the mobile navigation drawer (customer app). */
  onOpenMobileMenu?: () => void
}

/** Mobile-only strip: sidebar menu. Search, profile, and notifications live in PageToolbar. */
export default function Header({ onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 sm:px-6 lg:hidden">
      {onOpenMobileMenu ? (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex shrink-0 rounded-xl p-2 text-gray-700 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
      ) : null}
      <div className="ml-auto shrink-0">
        <GoogleTranslateControl />
      </div>
    </header>
  )
}
