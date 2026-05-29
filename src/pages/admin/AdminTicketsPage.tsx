import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight, Headphones, Send } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { selectShell } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/format'
import { fromAdminListResponse } from '@/lib/adminList'

type TicketMsg = {
  id: string
  author_name: string
  is_staff: boolean
  body: string
  created_at: string
}

type Ticket = {
  id: string
  ticket_number: string
  customer_name: string
  subject: string
  status: string
  priority: string
  created_at: string
  messages?: TicketMsg[]
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-50 text-red-800 ring-red-100'
    case 'HIGH':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    case 'LOW':
      return 'bg-gray-100 text-gray-600 ring-gray-200'
    default:
      return 'bg-sky-50 text-sky-800 ring-sky-100'
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    case 'IN_PROGRESS':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    case 'RESOLVED':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'CLOSED':
      return 'bg-gray-100 text-gray-600 ring-gray-200'
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function AdminTicketsPage() {
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [internalOnly, setInternalOnly] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery({ queryKey: ['admin-tickets'], queryFn: () => adminApi.tickets() })
  const tickets = fromAdminListResponse<Ticket>(data)

  const summary = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
    return { total: tickets.length, open }
  }, [tickets])

  const statusMutation = useMutation({
    mutationFn: ({ id, status: st }: { id: string; status: string }) => adminApi.updateTicketStatus(id, st),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      toast.success('Status updated.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Update failed.'),
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, body, is_internal }: { id: string; body: string; is_internal: boolean }) =>
      adminApi.ticketReply(id, body, is_internal),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      setReplyDrafts((d) => ({ ...d, [v.id]: '' }))
      toast.success(v.is_internal ? 'Internal note added.' : 'Reply sent to customer.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Reply failed.'),
  })

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Headphones size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Support tickets</h1>
            <p className="text-xs text-gray-500">Customer requests and staff replies</p>
          </div>
        </div>
        {!isLoading && tickets.length > 0 ? (
          <p className="text-xs font-semibold tabular-nums text-gray-500">
            {summary.total} {summary.total === 1 ? 'ticket' : 'tickets'}
            {summary.open > 0 ? (
              <>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="text-amber-800">{summary.open} open</span>
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-14 text-center">
            <Headphones size={32} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No support tickets</p>
            <p className="mt-1 text-xs text-gray-500">New tickets from customers will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((t) => {
              const open = openId === t.id
              const messages = t.messages ?? []
              return (
                <div key={t.id} className={cn('transition-colors', open && 'bg-gray-50/30')}>
                  <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:px-6">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : t.id)}
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                      aria-expanded={open}
                      aria-label={open ? 'Collapse ticket' : 'Expand ticket'}
                    >
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark/[0.08] text-xs font-bold text-primary-dark ring-1 ring-primary-dark/10"
                      aria-hidden
                    >
                      {userInitials(t.customer_name)}
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : t.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-gray-500">#{t.ticket_number}</span>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            priorityBadgeClass(t.priority),
                          )}
                        >
                          {t.priority}
                        </span>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset sm:hidden',
                            statusBadgeClass(t.status),
                          )}
                        >
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {t.customer_name} · {formatRelativeTime(t.created_at)}
                      </p>
                    </button>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                      <div
                        className={cn(selectShell, 'w-full min-w-0 sm:w-[9.5rem] shrink-0')}
                        onClick={(e) => e.stopPropagation()}
                      >
                      <select
                        value={t.status}
                        onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value })}
                        className="w-full cursor-pointer appearance-none rounded-xl bg-transparent py-2 pl-3 pr-8 text-[11px] font-bold uppercase tracking-wide text-gray-800 focus:outline-none"
                        aria-label={`Status for ticket ${t.ticket_number}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      <span
                        className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500"
                        aria-hidden
                      >
                        <ChevronDown size={14} />
                      </span>
                    </div>
                    </div>
                  </div>

                  {open ? (
                    <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        {messages.length === 0 ? (
                          <p className="text-center text-xs text-gray-400">No messages yet.</p>
                        ) : (
                          messages.map((m) => (
                            <div
                              key={m.id}
                              className={cn(
                                'rounded-xl px-3 py-2 text-sm',
                                m.is_staff
                                  ? 'ml-6 border border-primary-dark/10 bg-primary-dark/[0.04]'
                                  : 'mr-6 border border-gray-100 bg-white shadow-sm',
                              )}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {m.author_name}
                                {m.is_staff ? ' · Staff' : ''} · {formatRelativeTime(m.created_at)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-gray-800">{m.body}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary-dark focus:ring-primary/30"
                            checked={internalOnly[t.id] ?? false}
                            onChange={(e) => setInternalOnly((s) => ({ ...s, [t.id]: e.target.checked }))}
                          />
                          Internal note only
                        </label>
                        <textarea
                          className="min-h-[5.5rem] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                          placeholder={internalOnly[t.id] ? 'Staff-only note…' : 'Reply to customer…'}
                          value={replyDrafts[t.id] ?? ''}
                          onChange={(e) => setReplyDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                        />
                        <button
                          type="button"
                          disabled={replyMutation.isPending || !(replyDrafts[t.id] ?? '').trim()}
                          onClick={() =>
                            replyMutation.mutate({
                              id: t.id,
                              body: (replyDrafts[t.id] ?? '').trim(),
                              is_internal: internalOnly[t.id] ?? false,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-light disabled:opacity-50"
                        >
                          <Send size={14} aria-hidden />
                          {internalOnly[t.id] ? 'Add note' : 'Send reply'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {!isLoading && tickets.length > 0 ? (
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500">
            Expand a ticket to view the thread and reply
          </div>
        ) : null}
      </section>
    </div>
  )
}
