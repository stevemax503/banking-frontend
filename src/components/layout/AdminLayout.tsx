import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Wallet, ArrowLeftRight,
  CreditCard, Settings, HeadphonesIcon, ClipboardList,
  UserCog, X, Layers, Banknote, KeyRound, Shield, LogOut,
} from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'
import SafaPayLogo from '@/components/brand/SafaPayLogo'
import Header from './Header'
import GoogleTranslateControl from '@/components/layout/GoogleTranslateControl'

const adminNav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin' },
  { label: 'Users', icon: Users, to: '/admin/users' },
  { label: 'Verification codes', icon: KeyRound, to: '/admin/email-otps' },
  { label: 'Profile requests', icon: UserCog, to: '/admin/profile-requests' },
  { label: 'Accounts', icon: Wallet, to: '/admin/accounts' },
  { label: 'Transactions', icon: ArrowLeftRight, to: '/admin/transactions' },
  { label: 'Pending compliance', icon: Shield, to: '/admin/pending-compliance' },
  { label: 'Loans', icon: CreditCard, to: '/admin/loans' },
  { label: 'Card products', icon: Layers, to: '/admin/card-products' },
  { label: 'Fees & Rates', icon: Settings, to: '/admin/fees' },
  { label: 'Bill pay fees', icon: Banknote, to: '/admin/payment-fees' },
  { label: 'Tickets', icon: HeadphonesIcon, to: '/admin/tickets' },
  { label: 'Audit Log', icon: ClipboardList, to: '/admin/audit' },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const logoutStore = useAuthStore((s) => s.logout)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // ignore
    }
    logoutStore()
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-screen min-w-0 bg-surface">
      <button
        type="button"
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity lg:hidden',
          mobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-label="Close menu"
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={cn(
          'flex flex-col bg-primary-dark',
          'fixed inset-y-0 left-0 z-50 h-screen w-[min(300px,92vw)] max-w-[320px]',
          'transform transition-transform duration-300 ease-out motion-reduce:transition-none',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[200px] lg:max-w-none lg:flex-shrink-0 lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-5 py-5 lg:border-0 lg:py-6">
          <div className="min-w-0">
            <SafaPayLogo variant="light" size="sm" showTagline={false} to="/admin" />
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-accent">Admin</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex-shrink-0 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3 lg:py-0">
          {adminNav.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-accent'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} className={isActive ? 'text-accent' : 'text-white/50'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false)
              void handleLogout()
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={15} className="text-white/50" aria-hidden />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden items-center justify-end border-b border-gray-100 bg-white px-6 py-2.5 lg:flex">
          <GoogleTranslateControl />
        </div>
        <Header onOpenMobileMenu={() => setMobileNavOpen(true)} />
        <main className="min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
