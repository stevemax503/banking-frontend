import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Wallet,
  ArrowLeftRight,
  CircleDollarSign,
  Landmark,
  HeadphonesIcon,
  Flag,
  ChevronRight,
  Activity,
  KeyRound,
} from 'lucide-react'
import { adminApi } from '@/api/admin'
import Spinner from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/utils/format'
import { fromAdminListResponse } from '@/lib/adminList'
import { cn } from '@/utils/cn'

const PREVIEW_LIMIT = 5

type DashStat = {
  label: string
  value: string
  to: string
  icon: LucideIcon
  hint?: string
  variant?: 'default' | 'alert' | 'accent'
}

function MetricCard({ item }: { item: DashStat }) {
  const Icon = item.icon
  const isAlert = item.variant === 'alert'
  const isAccent = item.variant === 'accent'

  return (
    <Link
      to={item.to}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark',
        isAlert
          ? 'border-red-200/90 bg-gradient-to-br from-white to-red-50/50 shadow-[0_2px_12px_-4px_rgba(220,38,38,0.15)] hover:border-red-300 hover:shadow-md'
          : isAccent
            ? 'border-primary-dark/20 bg-gradient-to-br from-primary-dark/[0.07] via-white to-white shadow-[0_2px_12px_-4px_rgba(21,42,30,0.12)] hover:border-primary-dark/30 hover:shadow-md'
            : 'border-gray-200/90 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-primary-dark/15 hover:shadow-md',
        'hover:-translate-y-0.5 active:translate-y-0',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-0.5',
          isAlert ? 'bg-red-400' : isAccent ? 'bg-accent' : 'bg-primary-dark/20 group-hover:bg-primary-dark/40',
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors',
            isAlert
              ? 'bg-red-50 text-red-700 ring-red-100 group-hover:bg-red-100'
              : isAccent
                ? 'bg-primary-dark text-accent ring-primary-dark/30'
                : 'bg-gray-50 text-primary-dark ring-gray-100 group-hover:bg-primary-dark/5',
          )}
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </div>
        <ChevronRight
          size={18}
          className={cn(
            'shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100',
            isAlert ? 'text-red-400' : 'text-gray-300',
          )}
          aria-hidden
        />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{item.label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums tracking-tight', isAlert ? 'text-red-900' : 'text-gray-900')}>
        {item.value}
      </p>
      {item.hint ? <p className="mt-2 text-xs leading-snug text-gray-500">{item.hint}</p> : null}
      <span className="sr-only">Open {item.label}</span>
    </Link>
  )
}

function TransactionsCombinedCard({
  monthCount,
  flaggedCount,
  flaggedNum,
}: {
  monthCount: string
  flaggedCount: string
  flaggedNum: number
}) {
  const hasFlagged = flaggedNum > 0

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-200',
        'border-gray-200/90 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:border-primary-dark/15 hover:shadow-md',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-primary-dark/20 group-hover:bg-primary-dark/40"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-primary-dark ring-1 ring-inset ring-gray-100">
          <ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden />
        </div>
        <Link
          to="/admin/transactions"
          className="shrink-0 rounded-lg p-1 text-gray-300 opacity-0 transition hover:bg-gray-50 hover:text-primary-dark group-hover:opacity-100"
          aria-label="All transactions"
        >
          <ChevronRight size={18} aria-hidden />
        </Link>
      </div>

      <Link to="/admin/transactions" className="mt-4 block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Transactions (month)</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{monthCount}</p>
      </Link>

      <div
        className={cn(
          'mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5',
          hasFlagged
            ? 'border-red-200/90 bg-red-50/60'
            : 'border-gray-100 bg-gray-50/80',
        )}
      >
        <div className="flex items-center gap-2">
          <Flag size={14} className={hasFlagged ? 'text-red-600' : 'text-gray-400'} aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Flagged</span>
        </div>
        <Link
          to="/admin/transactions?status=FLAGGED"
          className={cn(
            'text-lg font-bold tabular-nums transition hover:underline',
            hasFlagged ? 'text-red-800' : 'text-gray-900',
          )}
        >
          {flaggedCount}
        </Link>
      </div>
    </div>
  )
}

function DashboardPanel({
  icon: Icon,
  title,
  description,
  viewAllTo,
  viewAllLabel = 'View all',
  children,
  footer,
}: {
  icon: LucideIcon
  title: string
  description: string
  viewAllTo: string
  viewAllLabel?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Icon size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <span className="rounded-full bg-primary-dark/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark">
                Last {PREVIEW_LIMIT}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
          </div>
        </div>
        <Link
          to={viewAllTo}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark shadow-sm transition hover:border-primary-dark/25 hover:bg-gray-50"
        >
          {viewAllLabel}
          <ChevronRight size={14} className="text-gray-400" aria-hidden />
        </Link>
      </div>
      {children}
      {footer ? (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500 sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  )
}

function actionBadgeClass(action: string) {
  const a = action.toUpperCase()
  if (a.includes('LOGIN') || a.includes('LOGOUT')) return 'bg-sky-50 text-sky-800 ring-sky-100'
  if (a.includes('TRANSFER') || a.includes('TRANSACTION')) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (a.includes('CREATE')) return 'bg-violet-50 text-violet-800 ring-violet-100'
  if (a.includes('UPDATE') || a.includes('DELETE')) return 'bg-amber-50 text-amber-900 ring-amber-100'
  return 'bg-gray-50 text-gray-700 ring-gray-100'
}

type AuditRow = {
  id: string
  timestamp: string
  actor_email: string
  actor_role?: string
  action: string
  target_model: string
  target_id?: string
  description: string
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.dashboard })
  const stats = data?.data

  const { data: auditRes, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-dashboard-audit-preview'],
    queryFn: () =>
      adminApi.auditLogs({
        actor_scope: 'customer',
        page: '1',
      }),
  })

  const auditRows = fromAdminListResponse<AuditRow>(auditRes).slice(0, PREVIEW_LIMIT)

  const { data: recentOtpRes, isLoading: recentOtpLoading } = useQuery({
    queryKey: ['admin-dashboard-recent-otps'],
    queryFn: () => adminApi.emailOtps({ page: '1', page_size: String(PREVIEW_LIMIT) }),
    refetchInterval: 15_000,
  })

  type OtpPreview = {
    id: string
    user_email: string
    user_name: string
    purpose: string
    purpose_label?: string
    token: string
    fee_line_name?: string | null
    created_at: string
    expires_at: string
    is_expired: boolean
    is_used: boolean
  }

  const recentOtpRows = fromAdminListResponse<OtpPreview>(recentOtpRes).slice(0, PREVIEW_LIMIT)

  const statItems: DashStat[] = [
    {
      label: 'Total customers',
      value: String(stats?.total_users ?? '—'),
      to: '/admin/users?role=CUSTOMER',
      icon: Users,
      hint: 'Retail users with the customer role',
      variant: 'accent',
    },
    {
      label: 'Active accounts',
      value: String(stats?.active_accounts ?? '—'),
      to: '/admin/accounts',
      icon: Wallet,
      hint: 'Accounts in active status',
    },
    {
      label: 'Volume (month)',
      value: stats != null ? formatCurrency(stats.transaction_volume_this_month ?? 0) : '—',
      to: '/admin/transactions',
      icon: CircleDollarSign,
      hint: 'Same-period transaction volume',
    },
    {
      label: 'Pending loans',
      value: String(stats?.pending_loan_applications ?? '—'),
      to: '/admin/loans',
      icon: Landmark,
      hint: 'Applications awaiting review',
    },
    {
      label: 'Open tickets',
      value: String(stats?.open_support_tickets ?? '—'),
      to: '/admin/tickets',
      icon: HeadphonesIcon,
      hint: 'Open or in-progress support cases',
    },
  ]

  const monthTxCount = String(stats?.total_transactions_this_month ?? '—')
  const flaggedTxCount = String(stats?.flagged_transactions ?? '—')
  const flaggedTxNum = stats?.flagged_transactions ?? 0

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Admin dashboard</h1>
        <Link
          to="/admin/audit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-dark px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-light sm:text-sm"
        >
          <Activity size={14} className="text-accent" aria-hidden />
          Audit log
          <ChevronRight size={14} className="text-accent/80" aria-hidden />
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-primary-dark">Operations</h2>
            <p className="mt-0.5 text-xs text-gray-500">Click a metric to open its admin page</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
          {statItems.slice(0, 2).map((item) => (
            <MetricCard key={item.label} item={item} />
          ))}
          <TransactionsCombinedCard
            monthCount={monthTxCount}
            flaggedCount={flaggedTxCount}
            flaggedNum={flaggedTxNum}
          />
          {statItems.slice(2).map((item) => (
            <MetricCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <DashboardPanel
          icon={KeyRound}
          title="Recent verification codes"
          description="Login MFA, transfer verification, and compliance fees"
          viewAllTo="/admin/email-otps"
          footer={
            <Link to="/admin/email-otps" className="font-semibold text-primary-dark hover:underline">
              See all verification codes →
            </Link>
          }
        >
          <div className="admin-table-scroll">
            {recentOtpLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : recentOtpRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">No verification codes issued recently.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5 sm:px-5">When</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-4 py-2.5 sm:px-5">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOtpRows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'transition-colors hover:bg-emerald-50/40',
                        i % 2 === 1 && 'bg-gray-50/40',
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-gray-500 sm:px-5">
                        {formatDate(row.created_at, 'MMM d, HH:mm')}
                      </td>
                      <td className="max-w-[10rem] px-3 py-3">
                        <p className="truncate text-xs font-semibold text-gray-800" title={row.user_name}>
                          {row.user_name}
                        </p>
                        <p className="truncate text-[10px] text-gray-400" title={row.user_email}>
                          {row.user_email}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-gray-700">{row.purpose_label ?? row.purpose}</span>
                        {row.fee_line_name ? (
                          <span className="mt-0.5 block text-[10px] text-gray-400">{row.fee_line_name}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block rounded-lg bg-primary-dark/[0.06] px-2.5 py-1 font-mono text-sm font-bold tracking-[0.2em] text-primary-dark ring-1 ring-primary-dark/10">
                          {row.token}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                        <span className="text-[11px] text-gray-500">{formatDate(row.expires_at, 'MMM d, HH:mm')}</span>
                        {row.is_expired ? (
                          <span className="ml-1.5 inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                            Expired
                          </span>
                        ) : row.is_used ? (
                          <span className="ml-1.5 inline-flex rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600">
                            Used
                          </span>
                        ) : (
                          <span className="ml-1.5 inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                            Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          icon={Activity}
          title="Recent customer activity"
          description="Latest audit events from customer accounts"
          viewAllTo="/admin/audit"
          footer={
            <Link to="/admin/audit" className="font-semibold text-primary-dark hover:underline">
              Open full audit log →
            </Link>
          }
        >
          <div className="admin-table-scroll">
            {auditLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : auditRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">No customer audit events yet.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5 sm:px-5">When</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Target</th>
                    <th className="px-4 py-2.5 sm:px-5">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditRows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'transition-colors hover:bg-emerald-50/40',
                        i % 2 === 1 && 'bg-gray-50/40',
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-gray-500 sm:px-5">
                        {formatDate(row.timestamp, 'MMM d, HH:mm')}
                      </td>
                      <td className="max-w-[9rem] truncate px-3 py-3 text-xs font-medium text-gray-800" title={row.actor_email}>
                        {row.actor_email || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            actionBadgeClass(row.action),
                          )}
                        >
                          {row.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-500">
                        <span className="font-medium text-gray-700">{row.target_model || '—'}</span>
                        {row.target_model && row.target_id ? (
                          <span className="ml-1 font-mono text-[10px] text-gray-400">#{String(row.target_id).slice(0, 8)}</span>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-gray-600 sm:px-5" title={row.description}>
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DashboardPanel>
      </div>
    </div>
  )
}
