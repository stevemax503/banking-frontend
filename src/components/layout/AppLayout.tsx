import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { PageChromeProvider, usePageChromeOverride } from '@/contexts/PageChromeContext'
import Sidebar from './Sidebar'
import Header from './Header'
import PageToolbar from './PageToolbar'
import PageAtmosphere from './PageAtmosphere'
import MobileBottomNav from './MobileBottomNav'
import NotificationsModal from '@/components/notifications/NotificationsModal'
import AccountLockedBanner from './AccountLockedBanner'

const NO_BACK_PATHS = new Set(['/dashboard'])

function AppMain({
  onOpenMobileMenu,
  onOpenNotifications,
}: {
  onOpenMobileMenu: () => void
  onOpenNotifications: () => void
}) {
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'
  const chromeOverride = usePageChromeOverride()
  const showBack = chromeOverride?.showBack ?? !NO_BACK_PATHS.has(location.pathname)

  return (
    <>
      <Header onOpenMobileMenu={onOpenMobileMenu} />
      <main
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto px-4 max-lg:pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:px-6',
          isDashboard
            ? 'py-3 sm:pb-5 sm:pt-3 lg:flex lg:flex-col lg:min-h-0 lg:px-6 lg:pb-6 lg:pt-2'
            : 'py-3 sm:pb-5 sm:pt-3 lg:px-6 lg:pb-6 lg:pt-2',
        )}
      >
        <PageAtmosphere />
        <div
          className={cn(
            'relative z-10 flex flex-col',
            isDashboard && 'min-h-0 flex-1',
          )}
        >
          <PageToolbar
            showBack={showBack}
            backLabel={chromeOverride?.backLabel}
            backTo={chromeOverride?.backTo}
            onBack={chromeOverride?.onBack}
            onOpenNotifications={onOpenNotifications}
          />
          <AccountLockedBanner />
          <div className={cn(isDashboard && 'flex min-h-0 flex-1 flex-col')}>
            <Outlet />
          </div>
        </div>
      </main>
    </>
  )
}

export default function AppLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
    setNotificationsOpen(false)
  }, [location.pathname])

  return (
    <PageChromeProvider>
      <div className="flex h-screen overflow-hidden bg-surface">
          <button
            type="button"
            className={cn(
              'fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity lg:hidden',
              mobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
            )}
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
          <div id="app-main-pane" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            <AppMain
              onOpenMobileMenu={() => setMobileNavOpen(true)}
              onOpenNotifications={() => setNotificationsOpen(true)}
            />
          </div>
          <MobileBottomNav />
          <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </div>
      </PageChromeProvider>
  )
}
