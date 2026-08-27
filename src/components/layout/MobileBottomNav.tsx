import { NavLink, useLocation } from 'react-router-dom'
import { Home, ArrowLeftRight, Headphones, MessageCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLiveChat } from '@/contexts/LiveChatContext'
import { guardUnlockedAccount } from '@/lib/accountLock'

export default function MobileBottomNav() {
  const { setOpen } = useLiveChat()
  const { pathname } = useLocation()
  const isHome = pathname === '/dashboard'

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
      isHome
        ? isActive
          ? 'text-primary-dark'
          : 'text-gray-500 hover:text-gray-800'
        : isActive
          ? 'text-accent'
          : 'text-white/55 hover:text-white',
    )

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 px-1 pb-[env(safe-area-inset-bottom,0px)] transition-colors duration-200 lg:hidden',
        isHome
          ? 'border-t border-gray-200/90 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md'
          : 'border-t border-white/10 bg-primary shadow-[0_-8px_28px_rgba(0,0,0,0.18)]',
      )}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        <NavLink to="/dashboard" end className={navLinkClass}>
          {({ isActive }) => (
            <>
              <Home size={22} strokeWidth={isActive ? 2.25 : 2} />
              <span>Home</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/transactions/transfer"
          className={navLinkClass}
          onClick={(e) => {
            if (!guardUnlockedAccount()) e.preventDefault()
          }}
        >
          {({ isActive }) => (
            <>
              <ArrowLeftRight size={22} strokeWidth={isActive ? 2.25 : 2} />
              <span>Transfer</span>
            </>
          )}
        </NavLink>
        <NavLink to="/support" className={navLinkClass}>
          {({ isActive }) => (
            <>
              <Headphones size={22} strokeWidth={isActive ? 2.25 : 2} />
              <span>Support</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            isHome ? 'text-gray-500 hover:text-gray-800' : 'text-white/55 hover:text-white',
          )}
        >
          <MessageCircle size={22} strokeWidth={2} />
          <span>Live chat</span>
        </button>
      </div>
    </nav>
  )
}
