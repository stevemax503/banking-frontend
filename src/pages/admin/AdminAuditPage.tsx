import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Filter, Search } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { StyledSelect } from '@/components/forms/StyledSelect'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { fromAdminListResponse } from '@/lib/adminList'

type AuditRow = {
  id: string
  timestamp: string
  actor_email: string
  actor_role: string
  action: string
  target_model: string
  target_id: string
  description: string
  ip_address: string
}

const ACTION_OPTIONS = [
  '',
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'FAILED_LOGIN',
  'TRANSACTION',
  'REVERSAL',
  'KYC_UPDATE',
  'VIEW_SENSITIVE',
  'LOAN_DECISION',
] as const

function actionBadgeClass(action: string) {
  const a = action.toUpperCase()
  if (a.includes('LOGIN') || a.includes('LOGOUT')) return 'bg-sky-50 text-sky-800 ring-sky-100'
  if (a.includes('TRANSFER') || a.includes('TRANSACTION')) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (a.includes('CREATE')) return 'bg-violet-50 text-violet-800 ring-violet-100'
  if (a.includes('UPDATE') || a.includes('DELETE')) return 'bg-amber-50 text-amber-900 ring-amber-100'
  return 'bg-gray-50 text-gray-700 ring-gray-100'
}

function roleBadgeClass(role: string) {
  if (role === 'CUSTOMER') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (role === 'SUPER_ADMIN') return 'bg-primary-dark/10 text-primary-dark ring-primary-dark/15'
  return 'bg-gray-100 text-gray-700 ring-gray-200'
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [actorScope, setActorScope] = useState<'customer' | 'all'>('customer')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', search, action, actorScope],
    queryFn: () =>
      adminApi.auditLogs({
        search: search || undefined,
        action: action || undefined,
        actor_scope: actorScope,
      }),
  })
  const logs = fromAdminListResponse<AuditRow>(data)

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <ClipboardList size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Audit log</h1>
            <p className="text-xs text-gray-500">Customer and staff activity trail</p>
          </div>
        </div>
        {!isLoading && logs.length > 0 ? (
          <p className="text-xs font-semibold tabular-nums text-gray-500">
            {logs.length} {logs.length === 1 ? 'event' : 'events'}
          </p>
        ) : null}
      </section>

      {isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load audit log. Try again as super admin if you need staff-only entries.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-dark sm:mr-2">
            <Filter size={14} aria-hidden />
            Filters
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search actor, target, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-9 text-sm"
            />
          </div>

          <StyledSelect
            label="Action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </StyledSelect>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Actor</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/80 p-0.5">
              <button
                type="button"
                onClick={() => setActorScope('customer')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  actorScope === 'customer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                Customers
              </button>
              <button
                type="button"
                onClick={() => setActorScope('all')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  actorScope === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                All actors
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ClipboardList size={32} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No events match your filters</p>
            <p className="mt-1 text-xs text-gray-500">Try a different search or actor scope.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 p-3 md:hidden sm:p-4">
              {logs.map((log) => (
                <AdminMobileCard key={log.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
                        actionBadgeClass(log.action),
                      )}
                    >
                      {log.action}
                    </span>
                    {log.actor_role ? (
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
                          roleBadgeClass(log.actor_role),
                        )}
                      >
                        {log.actor_role}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-800">{log.actor_email || 'System'}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{formatDate(log.timestamp, 'MMM d, HH:mm:ss')}</p>
                  <p className="mt-2 text-xs text-gray-600">{log.description || '—'}</p>
                  {log.target_model ? (
                    <p className="mt-1 font-mono text-[10px] text-gray-400">
                      {log.target_model}
                      {log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}
                    </p>
                  ) : null}
                </AdminMobileCard>
              ))}
            </ul>
            <div className="admin-table-scroll hidden md:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5 sm:px-6">Timestamp</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-4 py-2.5 sm:px-6">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-gray-500 sm:px-6">
                      {formatDate(log.timestamp, 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="max-w-[11rem] px-3 py-3">
                      <p className="truncate text-xs font-medium text-gray-800" title={log.actor_email}>
                        {log.actor_email || '—'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {log.actor_role ? (
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            roleBadgeClass(log.actor_role),
                          )}
                        >
                          {log.actor_role}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                          actionBadgeClass(log.action),
                        )}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      {log.target_model}
                      {log.target_id ? (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">#{log.target_id.slice(0, 8)}</span>
                      ) : null}
                    </td>
                    <td className="max-w-md px-3 py-3 text-xs text-gray-600" title={log.description}>
                      <span className="line-clamp-2">{log.description || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-gray-400 sm:px-6">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
            </div>
          </>
        )}

        {!isLoading && logs.length > 0 ? (
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500">
            Showing {logs.length} {logs.length === 1 ? 'event' : 'events'}
            {actorScope === 'customer' ? ' · customers only' : ' · all actors'}
            {action ? ` · ${action.replace(/_/g, ' ')}` : ''}
          </div>
        ) : null}
      </section>
    </div>
  )
}
