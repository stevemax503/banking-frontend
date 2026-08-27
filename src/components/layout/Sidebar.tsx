import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, PiggyBank,
  Landmark, HeadphonesIcon, Settings, LogOut, Plus,
  IdCard, Receipt, Repeat2, X, Shield,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore, useIsImpersonating } from '@/store/authStore'
import { guardUnlockedAccount } from '@/lib/accountLock'
import SafaPayLogo from '@/components/brand/SafaPayLogo'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Transactions', icon: ArrowLeftRight, to: '/transactions' },
  { label: 'Recurring', icon: Repeat2, to: '/recurring' },
  { label: 'Accounts', icon: Wallet, to: '/accounts' },
  { label: 'Cards', icon: IdCard, to: '/cards' },
  { label: 'Payments', icon: Receipt, to: '/payments' },
  { label: 'Savings', icon: PiggyBank, to: '/savings' },
  { label: 'Loans', icon: Landmark, to: '/loans' },
  { label: 'Support', icon: HeadphonesIcon, to: '/support' },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

type SidebarProps = {
  /** When false on viewports &lt; lg, drawer is off-screen. */
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const isImpersonating = useIsImpersonating()
  const endImpersonation = useAuthStore((s) => s.endImpersonation)

  function backToAdmin() {
    onCloseMobile?.()
    endImpersonation()
    navigate('/admin/users')
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-primary-dark',
        'fixed inset-y-0 left-0 z-50 h-screen w-[min(300px,92vw)] max-w-[320px]',
        'transform transition-transform duration-300 ease-out motion-reduce:transition-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:z-auto lg:h-screen lg:w-[180px] lg:max-w-none lg:flex-shrink-0 lg:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="px-5 py-5 lg:py-6 flex items-center justify-between gap-2.5 border-b border-white/5 lg:border-0">
        <SafaPayLogo variant="light" size="sm" showTagline={false} to="/dashboard" className="min-w-0" />
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden flex-shrink-0 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 lg:py-2 space-y-0.5 overflow-y-auto overscroll-contain">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => onCloseMobile?.()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-white/10 text-accent'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={cn(isActive ? 'text-accent' : 'text-white/50')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2">
        {isImpersonating && (
          <button
            type="button"
            onClick={backToAdmin}
            className="flex w-full items-center gap-2.5 rounded-xl bg-accent/15 px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
          >
            <Shield size={15} aria-hidden />
            Back to admin portal
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-white/50 hover:text-white rounded-xl hover:bg-white/5 transition-colors text-sm"
        >
          <LogOut size={15} />
          Sign out
        </button>

        {/* New Transfer CTA — compact; avoid global btn-accent px-6/py-3 on narrow rail */}
        <button
          type="button"
          onClick={() => {
            if (!guardUnlockedAccount()) return
            onCloseMobile?.()
            navigate('/transactions/transfer')
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-primary-dark transition-colors hover:bg-accent-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} aria-hidden />
          <span className="whitespace-nowrap">Transfer</span>
        </button>
      </div>
    </aside>
  )
}
