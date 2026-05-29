import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { notificationsApi } from '@/api/notifications'
import UserMenu from './UserMenu'
import GoogleTranslateControl from '@/components/layout/GoogleTranslateControl'

export type PageToolbarProps = {
  showBack?: boolean
  backLabel?: string
  /** When set, back is a router link instead of history.back(). */
  backTo?: string
  onBack?: () => void
  onOpenNotifications?: () => void
}

export default function PageToolbar({
  showBack = true,
  backLabel = 'Back',
  backTo,
  onBack,
  onOpenNotifications,
}: PageToolbarProps) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    enabled: isAuthenticated,
  })
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate(-1)
  }

  const backClassName =
    'inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900'

  return (
    <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
      <div className="min-w-0">
        {showBack ? (
          backTo ? (
            <Link to={backTo} className={backClassName}>
              <ArrowLeft size={16} strokeWidth={2} aria-hidden />
              {backLabel}
            </Link>
          ) : (
            <button type="button" onClick={handleBack} className={backClassName}>
              <ArrowLeft size={16} strokeWidth={2} aria-hidden />
              {backLabel}
            </button>
          )
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="hidden lg:block">
          <GoogleTranslateControl />
        </div>
        {onOpenNotifications ? (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-primary-dark">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>
        ) : null}
        <UserMenu />
      </div>
    </div>
  )
}
