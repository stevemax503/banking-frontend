import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, Filter, X, FileText, Calendar, Eye, EyeOff, Share2, Shield } from 'lucide-react'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import {
  endOfDay,
  endOfMonth,
  format as formatDateFns,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns'
import { transactionsApi } from '@/api/transactions'
import { accountsApi } from '@/api/accounts'
import { statementsApi } from '@/api/statements'
import { useAuthStore } from '@/store/authStore'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import { copyableAccountIdentifier, formatAccountIdentifierDisplay } from '@/lib/uaeAccount'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDisplayAmount, formatDisplayCurrency } from '@/utils/format'
import TransactionDetailDrawer from '@/components/transactions/TransactionDetailDrawer'
import ComplianceFeesModal from '@/components/transactions/ComplianceFeesModal'
import {
  CATEGORY_OPTIONS,
  type TransactionListItem,
  type UiCategory,
  getCategoryMeta,
  inferCategory,
  balanceDeltaForTransaction,
  isCreditForUser,
  transactionNarration,
  transactionNarrationBrief,
  formatTransactionStatusLabel,
  statusBadgeClass,
  canResumeCompliance,
  complianceSessionId,
} from '@/utils/transactionDisplay'
import { loadRecurringPayments, monthlyEquivalent } from '@/lib/recurringPaymentsStorage'
import type { AxiosResponse } from 'axios'

const FETCH_PAGE_SIZE = 30
/** Ensures the load-more spinner stays visible briefly (fast networks otherwise finish almost instantly). */
const MIN_LOAD_MORE_SPINNER_MS = 4000

type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | 'month' | 'lastMonth' | 'custom'

function resolveDateRange(preset: DatePreset, customFrom: string, customTo: string): { start?: string; end?: string } {
  const now = new Date()
  switch (preset) {
    case 'all':
      return {}
    case 'today':
      return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { start: startOfDay(y).toISOString(), end: endOfDay(y).toISOString() }
    }
    case '7d':
      return { start: startOfDay(subDays(now, 6)).toISOString(), end: endOfDay(now).toISOString() }
    case 'month':
      return { start: startOfMonth(now).toISOString(), end: endOfDay(now).toISOString() }
    case 'lastMonth': {
      const lm = subMonths(now, 1)
      return { start: startOfMonth(lm).toISOString(), end: endOfMonth(lm).toISOString() }
    }
    case 'custom':
      if (!customFrom || !customTo) return {}
      return {
        start: startOfDay(new Date(`${customFrom}T12:00:00`)).toISOString(),
        end: endOfDay(new Date(`${customTo}T12:00:00`)).toISOString(),
      }
    default:
      return {}
  }
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Successful' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
]

function extractResults(data: unknown): TransactionListItem[] {
  if (!data || typeof data !== 'object') return []
  const o = data as { results?: unknown }
  if (Array.isArray(o.results)) return o.results as TransactionListItem[]
  if (Array.isArray(data)) return data as TransactionListItem[]
  return []
}

function getNextPageFromResponse(res: AxiosResponse): number | undefined {
  const body = res.data as { next?: string | null }
  if (!body?.next) return undefined
  const m = String(body.next).match(/[?&]page=(\d+)/)
  return m ? parseInt(m[1], 10) : undefined
}

function groupTransactionsByDay(transactions: TransactionListItem[]) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const map = new Map<string, TransactionListItem[]>()
  for (const tx of sorted) {
    let key: string
    try {
      key = formatDateFns(parseISO(tx.created_at), 'yyyy-MM-dd')
    } catch {
      key = tx.created_at.slice(0, 10)
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((dayKey) => {
    let label: string
    try {
      label = formatDateFns(parseISO(dayKey), 'd MMMM yyyy')
    } catch {
      label = dayKey
    }
    return { dayKey, label, items: map.get(dayKey)! }
  })
}

/** Newest calendar day first; within each day, newest transaction first (matches dashboard / activity feed). */
function groupTransactionsByDayStatement(transactions: TransactionListItem[]) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const map = new Map<string, TransactionListItem[]>()
  for (const tx of sorted) {
    let key: string
    try {
      key = formatDateFns(parseISO(tx.created_at), 'yyyy-MM-dd')
    } catch {
      key = tx.created_at.slice(0, 10)
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((dayKey) => {
    let label: string
    try {
      label = formatDateFns(parseISO(dayKey), 'd MMMM yyyy')
    } catch {
      label = dayKey
    }
    return { dayKey, label, items: map.get(dayKey)! }
  })
}

function formatStatementDdMmYyyy(iso: string): string {
  try {
    return formatDateFns(parseISO(iso), 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

function valueDateIso(tx: TransactionListItem): string {
  return tx.completed_at || tx.created_at
}

/**
 * Balance after each transaction (portfolio total), anchored to current sum of account balances.
 * Only meaningful for the loaded window; uses newest-first reconciliation.
 */
function computeRunningBalanceByTxId(
  transactions: TransactionListItem[],
  userAccountIds: Set<string>,
  totalBalance: number,
): Map<string, number> {
  const sortedDesc = [...transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const map = new Map<string, number>()
  let cur = totalBalance
  for (const tx of sortedDesc) {
    map.set(tx.id, cur)
    const net = balanceDeltaForTransaction(tx, userAccountIds)
    cur -= net
  }
  return map
}

function accountStatusLabel(status: string | undefined): string {
  if (!status) return 'REGULAR'
  if (status === 'ACTIVE') return 'REGULAR'
  return status.replace(/_/g, ' ')
}

export default function TransactionListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState<UiCategory>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedStart, setAppliedStart] = useState<string | undefined>()
  const [appliedEnd, setAppliedEnd] = useState<string | undefined>()
  const [selected, setSelected] = useState<TransactionListItem | null>(null)
  const [complianceModalOpen, setComplianceModalOpen] = useState(false)
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [stmtStart, setStmtStart] = useState(() => formatDateFns(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [stmtEnd, setStmtEnd] = useState(() => formatDateFns(new Date(), 'yyyy-MM-dd'))
  const [stmtEmail, setStmtEmail] = useState('')
  const [eSignedStatement, setESignedStatement] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const user = useAuthStore((s) => s.user)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const loadMoreStartedAt = useRef<number | null>(null)
  const hideLoadMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadingMoreVisible, setLoadingMoreVisible] = useState(false)

  const refreshRecurringSummary = useCallback(() => {
    const rec = loadRecurringPayments().filter((r) => r.active)
    const total = rec.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
    return { count: rec.length, total }
  }, [])
  const [recurringSummary, setRecurringSummary] = useState(refreshRecurringSummary)

  useEffect(() => {
    setRecurringSummary(refreshRecurringSummary())
  }, [refreshRecurringSummary])

  useEffect(() => {
    const sync = () => setRecurringSummary(refreshRecurringSummary())
    window.addEventListener('focus', sync)
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshRecurringSummary])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 320)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: accountsRes } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
  })
  const accountRows = useMemo(() => {
    const rows = accountsRes?.data?.results || accountsRes?.data || []
    return rows as {
      id: string
      account_type: string
      account_number: string
      iban?: string | null
      balance: string
      status: string
      is_primary?: boolean
    }[]
  }, [accountsRes])

  const userAccountIds = useMemo(() => new Set(accountRows.map((a) => a.id)), [accountRows])

  const primaryAccount = useMemo(() => {
    return accountRows.find((a) => a.is_primary) || accountRows[0]
  }, [accountRows])

  useEffect(() => {
    if (statementOpen && user?.email) {
      setStmtEmail((prev) => (prev.trim() ? prev : user.email))
    }
  }, [statementOpen, user?.email])

  const requestStatementMutation = useMutation({
    mutationFn: async () => {
      if (!primaryAccount) throw new Error('No account')
      const start = new Date(`${stmtStart}T12:00:00`)
      const end = new Date(`${stmtEnd}T12:00:00`)
      if (start >= end) throw new Error('End date must be after start date.')
      return statementsApi.request({
        account_id: primaryAccount.id,
        period_start: stmtStart,
        period_end: stmtEnd,
        email: stmtEmail.trim(),
        e_signed: eSignedStatement,
      })
    },
    onSuccess: (res) => {
      const emailed = (res?.data as { email?: string })?.email || stmtEmail.trim()
      toast.success(
        eSignedStatement
          ? `Your statement is being prepared and will be emailed to ${emailed} with e-signed copy noted.`
          : `Your statement is being prepared and will be emailed to ${emailed} as a PDF attachment.`,
      )
      setStatementOpen(false)
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message.includes('End date')) {
        toast.error(err.message)
        return
      }
      const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
      const detail = data?.detail
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')
            : 'Could not start statement generation.'
      toast.error(msg)
    },
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['transactions', 'infinite', debouncedSearch, status, appliedStart, appliedEnd],
    queryFn: ({ pageParam }) =>
      transactionsApi.list({
        page: pageParam as number,
        page_size: FETCH_PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status ? { status } : {}),
        ...(appliedStart ? { start_date: appliedStart } : {}),
        ...(appliedEnd ? { end_date: appliedEnd } : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => getNextPageFromResponse(lastPage),
    refetchOnMount: 'always',
  })

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasNextPage) return
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]?.isIntersecting
        if (hit) void fetchNextPage()
      },
      { root: null, rootMargin: '160px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, fetchNextPage, data?.pages.length])

  useLayoutEffect(() => {
    if (isFetchingNextPage) {
      if (hideLoadMoreTimer.current) {
        clearTimeout(hideLoadMoreTimer.current)
        hideLoadMoreTimer.current = null
      }
      loadMoreStartedAt.current = Date.now()
      setLoadingMoreVisible(true)
      return undefined
    }
    if (loadMoreStartedAt.current === null) return undefined
    const started = loadMoreStartedAt.current
    const elapsed = Date.now() - started
    const wait = Math.max(0, MIN_LOAD_MORE_SPINNER_MS - elapsed)
    hideLoadMoreTimer.current = setTimeout(() => {
      setLoadingMoreVisible(false)
      loadMoreStartedAt.current = null
      hideLoadMoreTimer.current = null
    }, wait)
    return () => {
      if (hideLoadMoreTimer.current) {
        clearTimeout(hideLoadMoreTimer.current)
        hideLoadMoreTimer.current = null
      }
    }
  }, [isFetchingNextPage])

  const allResults = useMemo(
    () => (data?.pages ?? []).flatMap((p) => extractResults(p.data)),
    [data?.pages],
  )

  const filtered = useMemo(() => {
    if (category === 'all') return allResults
    return allResults.filter((tx) => inferCategory(tx) === category)
  }, [allResults, category])

  const grouped = useMemo(() => groupTransactionsByDay(filtered), [filtered])
  const groupedStatement = useMemo(() => groupTransactionsByDayStatement(filtered), [filtered])

  const portfolioTotalBalance = useMemo(
    () => accountRows.reduce((s, a) => s + parseFloat(a.balance || '0'), 0),
    [accountRows],
  )

  const runningBalanceByTxId = useMemo(
    () => computeRunningBalanceByTxId(filtered, userAccountIds, portfolioTotalBalance),
    [filtered, userAccountIds, portfolioTotalBalance],
  )

  /** Category is client-side; keep fetching until we find matches or exhaust the server list. */
  useEffect(() => {
    if (category === 'all') return
    if (filtered.length > 0) return
    if (!hasNextPage || isFetchingNextPage || isLoading) return
    void fetchNextPage()
  }, [category, filtered.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage])

  const monthNet = useMemo(() => {
    const start = startOfMonth(new Date())
    return allResults
      .filter((tx) => new Date(tx.created_at) >= start)
      .reduce((s, tx) => s + balanceDeltaForTransaction(tx, userAccountIds), 0)
  }, [allResults, userAccountIds])

  const selectedIsCredit = selected ? isCreditForUser(selected, userAccountIds) : false

  const openComplianceResume = useCallback((tx: TransactionListItem) => {
    const sid = complianceSessionId(tx)
    if (!sid) return
    setResumeSessionId(sid)
    setComplianceModalOpen(true)
    setSelected(null)
  }, [])

  const activeFilterCount =
    (datePreset !== 'all' ? 1 : 0) + (category !== 'all' ? 1 : 0) + (status !== '' ? 1 : 0)

  const resetFilters = () => {
    setDatePreset('all')
    setAppliedStart(undefined)
    setAppliedEnd(undefined)
    setCustomFrom('')
    setCustomTo('')
    setCategory('all')
    setStatus('')
  }

  const applyDatePreset = (key: DatePreset) => {
    setDatePreset(key)
    const r = resolveDateRange(key, customFrom, customTo)
    setAppliedStart(r.start)
    setAppliedEnd(r.end)
  }

  const searchToolbar = (
    <div className="flex flex-col gap-2 border-b border-gray-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input-field w-full py-2.5 pl-10 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
          activeFilterCount > 0
            ? 'border-primary-dark bg-primary-dark text-white'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
        )}
      >
        <Filter size={16} strokeWidth={2} />
        Filters
        {activeFilterCount > 0 ? (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-primary-dark">
            {activeFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  )

  const filterChip = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
      active ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80',
    )

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="flex flex-col gap-3 bg-primary-dark px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Transactions</h1>
            <p className="mt-0.5 text-sm text-white/75">
              This month{' '}
              <span className="font-semibold text-white">{formatDisplayAmount(Math.abs(monthNet), monthNet >= 0)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatementOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <FileText size={16} strokeWidth={2} />
            Statement
          </button>
        </div>

        {recurringSummary.count > 0 ? (
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-2.5 text-sm">
            <span className="text-gray-600">
              Recurring · {recurringSummary.count} active ·{' '}
              <span className="font-semibold text-gray-900">
                ${recurringSummary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
              </span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/recurring')}
              className="shrink-0 text-xs font-semibold text-primary-dark hover:underline"
            >
              View
            </button>
          </div>
        ) : null}

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" transition />
        <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <DialogPanel
            transition
            className="flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between bg-primary-dark px-5 py-4">
              <DialogTitle className="text-lg font-bold text-white">Filters</DialogTitle>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Date</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['all', 'All'],
                      ['today', 'Today'],
                      ['yesterday', 'Yesterday'],
                      ['7d', '7 days'],
                      ['month', 'This month'],
                      ['lastMonth', 'Last month'],
                    ] as const
                  ).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => applyDatePreset(key)} className={filterChip(datePreset === key)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    aria-label="From date"
                  />
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    aria-label="To date"
                  />
                </div>
                <button type="button" className="btn-outline mt-2 w-full py-2 text-sm" onClick={() => applyDatePreset('custom')}>
                  Apply custom dates
                </button>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setCategory(id)} className={filterChip(category === id)}>
                      {label.replace('All Categories', 'All')}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value || 'all'}
                      type="button"
                      onClick={() => setStatus(o.value)}
                      className={filterChip(status === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-gray-100 px-5 py-4">
              <button type="button" className="btn-outline flex-1 py-2.5 text-sm" onClick={resetFilters}>
                Reset
              </button>
              <button type="button" className="btn-primary flex-1 py-2.5 text-sm" onClick={() => setFilterOpen(false)}>
                Apply
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <Dialog open={statementOpen} onClose={() => setStatementOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" transition />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white text-gray-900 shadow-xl"
          >
            <div className="flex items-center justify-between bg-primary-dark px-5 py-4">
              <DialogTitle className="text-lg font-bold text-white">Statement</DialogTitle>
              <button
                type="button"
                onClick={() => setStatementOpen(false)}
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-2 px-3 py-3 sm:px-4">
              {primaryAccount ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-2xl">
                        {balanceVisible ? formatDisplayCurrency(primaryAccount.balance) : '••••••'}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 leading-snug sm:text-sm">
                        {formatAccountTypeLabel(primaryAccount.account_type).toUpperCase()} (
                        {primaryAccount.account_type}){' '}
                        <span className="font-semibold text-gray-900 font-mono text-[11px] sm:text-xs">
                          {formatAccountIdentifierDisplay(primaryAccount)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 sm:text-xs">
                        Account Status:{' '}
                        <span className="font-semibold text-gray-700">
                          {accountStatusLabel(primaryAccount.status)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setBalanceVisible((v) => !v)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
                        aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
                      >
                        {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(copyableAccountIdentifier(primaryAccount))
                          toast.success('IBAN copied')
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
                        aria-label="Copy IBAN"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No account available for statements.</p>
              )}

              <div className="space-y-2">
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-gray-500">Start Date</p>
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                  </div>
                  <input
                    type="date"
                    value={stmtStart}
                    onChange={(e) => setStmtStart(e.target.value)}
                    className="input-field mt-1 w-full cursor-pointer py-2 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-gray-500">End Date</p>
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                  </div>
                  <input
                    type="date"
                    value={stmtEnd}
                    onChange={(e) => setStmtEnd(e.target.value)}
                    className="input-field mt-1 w-full cursor-pointer py-2 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <label htmlFor="stmt-email" className="text-[11px] font-medium text-gray-500">
                    Email
                  </label>
                  <input
                    id="stmt-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={stmtEmail}
                    onChange={(e) => setStmtEmail(e.target.value)}
                    className="input-field mt-1 py-2 text-sm"
                  />
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <span className="min-w-0 flex-1 text-xs text-gray-700 sm:text-sm">
                    Generate e-signed statement?
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={eSignedStatement}
                    onClick={() => setESignedStatement((v) => !v)}
                    className={cn(
                      'inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      eSignedStatement ? 'justify-end bg-primary' : 'justify-start bg-gray-300',
                    )}
                  >
                    <span className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/[0.06]" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 px-3 py-3 sm:px-4">
              <button
                type="button"
                disabled={
                  !primaryAccount ||
                  requestStatementMutation.isPending ||
                  !stmtEmail.trim() ||
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stmtEmail.trim())
                }
                onClick={() => {
                  const start = new Date(`${stmtStart}T12:00:00`)
                  const end = new Date(`${stmtEnd}T12:00:00`)
                  if (start >= end) {
                    toast.error('End date must be after start date.')
                    return
                  }
                  requestStatementMutation.mutate()
                }}
                className="btn-primary w-full justify-center py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-45"
              >
                {requestStatementMutation.isPending ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <div className="min-w-0">
        {isLoading ? (
          <>
            {searchToolbar}
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          </>
        ) : grouped.length === 0 && (hasNextPage || loadingMoreVisible || isFetchingNextPage) ? (
          <>
            {searchToolbar}
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16" role="status">
              <Spinner size="lg" />
              <p className="text-center text-sm font-medium text-gray-500">Loading more transactions…</p>
            </div>
          </>
        ) : grouped.length === 0 ? (
          <>
            {searchToolbar}
            <p className="px-4 py-14 text-center text-sm text-gray-400">No transactions match your filters.</p>
          </>
        ) : (
          <>
            <div className="md:hidden">
              {searchToolbar}
              {grouped.map((group) => (
                <div key={group.dayKey}>
                  <div
                    className={cn(
                      'sticky top-0 z-10 px-4 py-2.5',
                      'text-[11px] font-semibold text-gray-500 tracking-wide',
                      'bg-gray-100/95 backdrop-blur-sm border-b border-gray-200/80',
                    )}
                  >
                    {group.label}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.items.map((tx) => {
                      const cat = inferCategory(tx)
                      const { label: catLabel, Icon: CatIcon, badgeClass } = getCategoryMeta(cat)
                      const credit = isCreditForUser(tx, userAccountIds)
                      const amt = parseFloat(tx.amount)
                      const subline = tx.reference_number ? `Ref · ${tx.reference_number}` : undefined
                      const showResume = canResumeCompliance(tx)
                      return (
                        <div
                          key={tx.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelected(tx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelected(tx)
                            }
                          }}
                          className="w-full cursor-pointer text-left hover:bg-gray-50/90 transition-colors"
                        >
                          <div className="flex items-start gap-3 px-4 py-3.5">
                            <div className="w-10 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-primary-dark shrink-0">
                              <CatIcon size={18} strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-sm font-semibold leading-snug text-gray-900">
                                {transactionNarrationBrief(tx, 72)}
                              </p>
                              {subline && <p className="text-xs text-gray-500 mt-0.5 truncate">{subline}</p>}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', badgeClass)}>
                                  {catLabel}
                                </span>
                                {tx.status === 'PENDING' ? (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-100">
                                    Pending
                                  </span>
                                ) : null}
                              </div>
                              {showResume ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openComplianceResume(tx)
                                  }}
                                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-dark hover:underline"
                                >
                                  <Shield size={14} strokeWidth={1.75} />
                                  Continue compliance
                                </button>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right pt-0.5 min-w-[4.5rem]">
                              <span
                                className={cn(
                                  'text-sm font-bold tabular-nums',
                                  credit ? 'text-green-600' : 'text-red-600',
                                )}
                              >
                                {formatDisplayAmount(amt, credit)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <div className="sticky top-0 z-20 bg-white">{searchToolbar}</div>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm text-gray-900">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="py-3 pl-4 pr-3 text-left">Trans date</th>
                      <th className="px-3 py-3 text-left">Value date</th>
                      <th className="px-3 py-3 text-right">Debit</th>
                      <th className="px-3 py-3 text-right">Credit</th>
                      <th className="px-3 py-3 text-right">Balance</th>
                      <th className="px-3 py-3 text-left">Status</th>
                      <th className="min-w-[12rem] py-3 pl-3 pr-4 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedStatement.map((group, gi) => {
                      const priorCount = groupedStatement.slice(0, gi).reduce((s, g) => s + g.items.length, 0)
                      return (
                        <Fragment key={group.dayKey}>
                          <tr className="bg-gray-50/90">
                            <td colSpan={7} className="py-2 pl-4 pr-4 text-xs font-semibold text-gray-600">
                              {group.label}
                            </td>
                          </tr>
                          {group.items.map((tx, ti) => {
                            const credit = isCreditForUser(tx, userAccountIds)
                            const amt = parseFloat(tx.amount)
                            const zebra = (priorCount + ti) % 2 === 1
                            const bal = runningBalanceByTxId.get(tx.id)
                            return (
                              <tr
                                key={tx.id}
                                className={cn(
                                  'cursor-pointer border-b border-gray-100 transition-colors hover:bg-primary-dark/[0.03]',
                                  zebra ? 'bg-gray-50/40' : 'bg-white',
                                )}
                                onClick={() => setSelected(tx)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setSelected(tx)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <td className="whitespace-nowrap py-3 pl-4 pr-3 tabular-nums text-gray-700">
                                  {formatStatementDdMmYyyy(tx.created_at)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-gray-600">
                                  {formatStatementDdMmYyyy(valueDateIso(tx))}
                                </td>
                                <td className="px-3 py-3 text-right tabular-nums text-gray-800">
                                  {!credit ? formatDisplayCurrency(amt) : '—'}
                                </td>
                                <td className="px-3 py-3 text-right tabular-nums font-medium text-emerald-700">
                                  {credit ? formatDisplayCurrency(amt) : '—'}
                                </td>
                                <td className="px-3 py-3 text-right font-semibold tabular-nums text-gray-900">
                                  {bal !== undefined ? formatDisplayCurrency(bal) : '—'}
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', statusBadgeClass(tx.status))}>
                                    {formatTransactionStatusLabel(tx.status)}
                                  </span>
                                </td>
                                <td className="max-w-[18rem] px-3 py-3 pr-4 align-top">
                                  <p className="truncate font-medium text-gray-800" title={transactionNarration(tx)}>
                                    {transactionNarrationBrief(tx, 64)}
                                  </p>
                                  {canResumeCompliance(tx) ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openComplianceResume(tx)
                                      }}
                                      className="mt-1 text-xs font-semibold text-primary-dark hover:underline"
                                    >
                                      Continue compliance
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!isLoading && grouped.length > 0 && (
          <div className="border-t border-gray-100 px-4 pb-6 pt-2 sm:px-6">
            <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
            {loadingMoreVisible && (
              <div className="flex flex-col items-center justify-center gap-3 py-8" role="status" aria-live="polite">
                <Spinner size="lg" />
                <p className="text-sm font-medium text-gray-500">Loading more transactions…</p>
              </div>
            )}
            {!hasNextPage && !loadingMoreVisible && filtered.length > 0 && (
              <p className="pt-4 text-center text-xs font-medium text-gray-500">End of list</p>
            )}
          </div>
        )}
      </div>
      </div>

      <TransactionDetailDrawer
        transaction={selected}
        isCredit={selectedIsCredit}
        onClose={() => setSelected(null)}
        onContinueCompliance={openComplianceResume}
      />

      <ComplianceFeesModal
        open={complianceModalOpen}
        sessionId={resumeSessionId}
        onClose={() => {
          setComplianceModalOpen(false)
          setResumeSessionId(null)
          void queryClient.invalidateQueries({ queryKey: ['transactions'] })
          void queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }}
        onCompleted={(tx) => {
          setComplianceModalOpen(false)
          setResumeSessionId(null)
          if (tx) {
            navigate('/transactions/transfer', { state: { completedTransaction: tx } })
          }
        }}
      />
    </div>
  )
}
