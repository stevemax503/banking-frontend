import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Pencil,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { adminApi } from '@/api/admin'
import AdminInlineSelect from '@/components/admin/AdminInlineSelect'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import { selectShell } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDate, formatDisplayCurrency } from '@/utils/format'
import { formatTransactionStatusLabel } from '@/utils/transactionDisplay'
import AdminUserCombobox from '@/components/admin/AdminUserCombobox'
import DateRangeFilter, { type AppliedDateRange } from '@/components/admin/DateRangeFilter'
import type { DateRangeSelection } from '@/lib/dateRangePresets'

type AdminTx = {
  id: string
  reference_number: string
  transaction_type: string
  amount: string
  fee_amount: string
  currency: string
  status: string
  description: string
  created_at: string
  customer_email?: string
  initiated_by_email?: string
  metadata?: Record<string, unknown> | null
}

type PaginatedResponse = {
  count?: number
  next?: string | null
  previous?: string | null
  results?: AdminTx[]
}

const TX_TYPES = [
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_INTERNAL',
  'TRANSFER_EXTERNAL',
  'TRANSFER_INTERNATIONAL',
  'FEE',
  'REVERSAL',
  'LOAN_DISBURSEMENT',
  'LOAN_PAYMENT',
  'INTEREST',
] as const

const STATUSES = ['COMPLETED', 'PENDING', 'FAILED', 'REVERSED', 'FLAGGED'] as const

const PAGE_SIZE = 50

const emptyEditForm = {
  amount: '',
  fee_amount: '',
  status: 'COMPLETED',
  transaction_type: 'DEPOSIT',
  description: '',
  currency: 'USD',
}

function typeLabel(type: string) {
  return type.replace(/_/g, ' ')
}

const TX_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...TX_TYPES.map((t) => ({ value: t, label: typeLabel(t) })),
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: formatTransactionStatusLabel(s) })),
]

function typeBadgeClass(type: string) {
  if (type.includes('TRANSFER')) return 'bg-sky-50 text-sky-800 ring-sky-100'
  if (type === 'DEPOSIT' || type === 'LOAN_DISBURSEMENT' || type === 'INTEREST') {
    return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  }
  if (type === 'WITHDRAWAL' || type === 'LOAN_PAYMENT' || type === 'FEE') {
    return 'bg-rose-50 text-rose-800 ring-rose-100'
  }
  if (type === 'REVERSAL') return 'bg-violet-50 text-violet-800 ring-violet-100'
  return 'bg-gray-50 text-gray-700 ring-gray-100'
}

function statusBadgeClass(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (status === 'FLAGGED') return 'bg-red-50 text-red-800 ring-red-100'
  if (status === 'REVERSED') return 'bg-gray-100 text-gray-700 ring-gray-200'
  if (status === 'FAILED') return 'bg-red-50 text-red-700 ring-red-100'
  return 'bg-amber-50 text-amber-900 ring-amber-100'
}

function customerInitial(email?: string) {
  const c = (email || '?').charAt(0).toUpperCase()
  return c
}

function FilterField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
      {children}
    </div>
  )
}

export default function AdminTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '')
  const [typeFilter, setTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeSelection | null>(null)
  const [appliedDateRange, setAppliedDateRange] = useState<AppliedDateRange | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editTx, setEditTx] = useState<AdminTx | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      Boolean(
        searchParams.get('status') ||
          searchParams.get('user') ||
          searchParams.get('type') ||
          searchParams.get('created_from'),
      ),
  )

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '')
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter, userFilter, appliedDateRange])

  const queryClient = useQueryClient()

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {
      page: String(page),
      page_size: String(PAGE_SIZE),
    }
    if (search.trim()) p.search = search.trim()
    if (statusFilter) p.status = statusFilter
    if (typeFilter) p.transaction_type = typeFilter
    if (userFilter.trim()) p.user = userFilter.trim()
    if (appliedDateRange) {
      p.created_from = appliedDateRange.created_from
      p.created_to = appliedDateRange.created_to
    }
    return p
  }, [search, statusFilter, typeFilter, userFilter, appliedDateRange, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-transactions', queryParams],
    queryFn: () => adminApi.transactions(queryParams),
    placeholderData: (prev) => prev,
  })

  const payload = data?.data as PaginatedResponse | AdminTx[] | undefined
  const transactions = Array.isArray(payload) ? payload : (payload?.results ?? [])
  const totalCount = Array.isArray(payload) ? transactions.length : (payload?.count ?? transactions.length)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  const hasFilters = Boolean(
    search.trim() || statusFilter || typeFilter || userFilter.trim() || appliedDateRange,
  )

  const dropdownFilterCount = [typeFilter, statusFilter, userFilter.trim(), appliedDateRange].filter(Boolean).length

  const pageStats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'COMPLETED').length
    const pending = transactions.filter((t) => t.status === 'PENDING').length
    return { completed, pending }
  }, [transactions])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateTransaction(editTx!.id, {
        amount: editForm.amount,
        fee_amount: editForm.fee_amount,
        status: editForm.status,
        transaction_type: editForm.transaction_type,
        description: editForm.description,
        currency: editForm.currency,
      }),
    onSuccess: () => {
      invalidate()
      setEditTx(null)
      toast.success('Transaction updated.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Update failed.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? adminApi.deleteTransaction(ids[0]) : adminApi.bulkDeleteTransactions(ids),
    onSuccess: (_res, ids) => {
      invalidate()
      setSelected(new Set())
      toast.success(ids.length === 1 ? 'Transaction deleted.' : `Deleted ${ids.length} transaction(s).`)
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Delete failed.'),
  })

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setUserFilter('')
    setAppliedDateRange(null)
    setDateRange(null)
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) setSelected(new Set())
    else setSelected(new Set(transactions.map((t) => t.id)))
  }

  const openEdit = (tx: AdminTx) => {
    setEditTx(tx)
    setEditForm({
      amount: tx.amount,
      fee_amount: tx.fee_amount || '0',
      status: tx.status,
      transaction_type: tx.transaction_type,
      description: tx.description || '',
      currency: tx.currency || 'USD',
    })
  }

  const confirmDeleteSelected = () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} selected transaction(s)?`)) return
    deleteMutation.mutate(ids)
  }

  const searchField = (
    <div className={cn(selectShell, 'relative min-w-0 flex-1')}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search reference, description, account…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
    </div>
  )

  const dropdownFilters = (
    <>
      <FilterField label="Customer">
        <AdminUserCombobox
          value={userFilter}
          onChange={setUserFilter}
          placeholder="All customers"
          className="w-full"
        />
      </FilterField>
      <FilterField label="Type">
        <AdminInlineSelect
          label="Transaction type"
          options={TX_TYPE_OPTIONS}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
      </FilterField>
      <FilterField label="Status">
        <AdminInlineSelect
          label="Transaction status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value
            setStatusFilter(v)
            const next = new URLSearchParams(searchParams)
            if (v) next.set('status', v)
            else next.delete('status')
            setSearchParams(next, { replace: true })
          }}
        />
      </FilterField>
      <FilterField label="Date range" className="sm:col-span-2 lg:col-span-1">
        <DateRangeFilter
          layout="inline"
          value={dateRange}
          onChange={setDateRange}
          onApply={(applied) => {
            setAppliedDateRange(applied)
            if (!applied) setDateRange(null)
          }}
        />
      </FilterField>
      {hasFilters ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : null}
    </>
  )

  const filtersToggle = (
    <button
      type="button"
      onClick={() => setFiltersOpen((open) => !open)}
      aria-expanded={filtersOpen}
      className={cn(
        selectShell,
        'flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left sm:w-auto sm:min-w-[10rem]',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Filter size={15} className="text-primary-dark" aria-hidden />
        Filters
        {dropdownFilterCount > 0 ? (
          <span className="rounded-full bg-primary-dark px-2 py-0.5 text-[10px] font-bold text-accent">
            {dropdownFilterCount}
          </span>
        ) : null}
      </span>
      <ChevronDown
        size={18}
        className={cn('shrink-0 text-gray-500 transition-transform', filtersOpen && 'rotate-180')}
        aria-hidden
      />
    </button>
  )

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <ArrowLeftRight size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Transactions</h1>
            <p className="hidden text-xs text-gray-500 sm:block">Ledger entries — view, edit, or remove</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {!isLoading && totalCount > 0 ? (
            <p className="text-xs font-semibold tabular-nums text-gray-500">
              {totalCount.toLocaleString()} total
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="text-emerald-700">{pageStats.completed} ok</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="text-amber-800">{pageStats.pending} pending</span>
            </p>
          ) : null}
          <div className="flex gap-2">
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={confirmDeleteSelected}
                disabled={deleteMutation.isPending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60 sm:flex-none"
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 size={14} aria-hidden />
                )}
                Delete {selected.size}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
            >
              <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} aria-hidden />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white">
          <div className="flex flex-col gap-2.5 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
            {searchField}
            {filtersToggle}
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 border-t border-gray-100 px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              {dropdownFilters}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Receipt className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No transactions found</p>
            <p className="mt-1 text-xs text-gray-500">
              {hasFilters ? 'Try adjusting your filters.' : 'Transactions will appear here as customers move money.'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-outline mt-4 text-xs">
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="space-y-3 p-3 md:hidden sm:p-4">
              {transactions.map((tx) => {
                const email = tx.customer_email || tx.initiated_by_email || ''
                const isSelected = selected.has(tx.id)
                return (
                  <AdminMobileCard
                    key={tx.id}
                    className={cn(
                      'overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_2px_16px_-6px_rgba(21,42,30,0.1)]',
                      isSelected && 'ring-2 ring-primary-dark/20',
                    )}
                  >
                    <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-gray-300 text-primary focus:ring-primary/30"
                          checked={isSelected}
                          onChange={() => toggleSelect(tx.id)}
                          aria-label={`Select ${tx.reference_number}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-mono text-xs font-semibold text-gray-800">{tx.reference_number}</p>
                            <p className="shrink-0 text-base font-bold tabular-nums text-gray-900">
                              {formatDisplayCurrency(tx.amount)}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                              {customerInitial(email)}
                            </span>
                            <span className="truncate text-xs text-gray-600" title={email}>
                              {email || '—'}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                                typeBadgeClass(tx.transaction_type),
                              )}
                            >
                              {typeLabel(tx.transaction_type)}
                            </span>
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                                statusBadgeClass(tx.status),
                              )}
                            >
                              {formatTransactionStatusLabel(tx.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] tabular-nums text-gray-400">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                        <button
                          type="button"
                          onClick={() => openEdit(tx)}
                          className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-gray-700 shadow-sm transition hover:border-primary-dark/20 hover:text-primary-dark"
                        >
                          <Pencil size={14} aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete ${tx.reference_number}?`)) deleteMutation.mutate([tx.id])
                          }}
                          className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-red-200/90 bg-red-50/80 px-2.5 py-2 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                        >
                          <Trash2 size={14} aria-hidden />
                          Delete
                        </button>
                      </div>
                    </div>
                  </AdminMobileCard>
                )
              })}
            </ul>

            <div className="admin-table-scroll hidden md:block">
              <table className="admin-data-table min-w-[960px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="w-12 px-4 py-3.5">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary/30"
                        checked={transactions.length > 0 && selected.size === transactions.length}
                        onChange={toggleSelectAll}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3.5">Reference</th>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx, i) => {
                    const email = tx.customer_email || tx.initiated_by_email || ''
                    const isSelected = selected.has(tx.id)
                    return (
                      <tr
                        key={tx.id}
                        className={cn(
                          'transition-colors hover:bg-emerald-50/30',
                          i % 2 === 1 && 'bg-gray-50/40',
                          isSelected && 'bg-primary-dark/[0.04]',
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary/30"
                            checked={isSelected}
                            onChange={() => toggleSelect(tx.id)}
                            aria-label={`Select ${tx.reference_number}`}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-medium text-gray-800">{tx.reference_number}</span>
                        </td>
                        <td className="max-w-[11rem] px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                              {customerInitial(email)}
                            </span>
                            <span className="truncate text-xs text-gray-700" title={email}>
                              {email || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                              typeBadgeClass(tx.transaction_type),
                            )}
                          >
                            {typeLabel(tx.transaction_type)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                          {formatDisplayCurrency(tx.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                              statusBadgeClass(tx.status),
                            )}
                          >
                            {formatTransactionStatusLabel(tx.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-gray-500">
                          {formatDate(tx.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(tx)}
                              title="Edit"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-primary-dark/20 hover:text-primary-dark"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Edit</span>
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete ${tx.reference_number}?`)) deleteMutation.mutate([tx.id])
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-5">
          <p className="text-xs text-gray-500">
            {totalCount > 0 ? (
              <>
                Showing <span className="font-semibold text-gray-700">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalCount.toLocaleString()}</span>
              </>
            ) : (
              'No results'
            )}
            {isFetching && !isLoading ? (
              <span className="ml-2 inline-flex items-center gap-1 text-primary">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Updating…
              </span>
            ) : null}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[5rem] px-2 text-center text-xs font-medium text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Edit modal */}
      {editTx ? (
        <div
          className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-tx-title"
        >
          <div className="w-full max-w-[min(100%,32rem)] overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="edit-tx-title" className="text-lg font-semibold text-gray-900">
                  Edit transaction
                </h2>
                <p className="mt-0.5 font-mono text-xs text-gray-500">{editTx.reference_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTx(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Type</label>
                  <select
                    className="input-field w-full text-sm"
                    value={editForm.transaction_type}
                    onChange={(e) => setEditForm({ ...editForm, transaction_type: e.target.value })}
                  >
                    {TX_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
                  <select
                    className="input-field w-full text-sm"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {formatTransactionStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field w-full text-sm tabular-nums"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field w-full text-sm tabular-nums"
                    value={editForm.fee_amount}
                    onChange={(e) => setEditForm({ ...editForm, fee_amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Currency</label>
                  <input
                    className="input-field w-full text-sm uppercase"
                    maxLength={3}
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Description</label>
                  <input
                    className="input-field w-full text-sm"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-4 sm:flex-row sm:px-5">
              <button type="button" onClick={() => setEditTx(null)} className="btn-outline flex-1 rounded-xl text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editForm.amount}
                className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl text-sm disabled:opacity-60"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
