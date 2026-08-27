import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, Eye, EyeOff, Lock, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { accountsApi } from '@/api/accounts'
import { transactionsApi } from '@/api/transactions'
import { useAuthStore, useAuthReady } from '@/store/authStore'
import StatCard from '@/components/ui/StatCard'
import TransactionRow from '@/components/ui/TransactionRow'
import CardWidget from '@/components/ui/CardWidget'
import Spinner from '@/components/ui/Spinner'
import { formatCurrency, DISPLAY_CURRENCY_SYMBOL } from '@/utils/format'
import { cn } from '@/utils/cn'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import LoanOffersMarquee from '@/components/dashboard/LoanOffersMarquee'
import TransactionDetailDrawer from '@/components/transactions/TransactionDetailDrawer'
import { useIsLgUp } from '@/hooks/useMediaQuery'
import { fromApiListResponse } from '@/lib/apiList'
import { type TransactionListItem, isCreditForUser } from '@/utils/transactionDisplay'
import { accountIdentifierLastFour, formatAccountIdentifierDisplay, maskAccountIdentifier } from '@/lib/uaeAccount'
import { guardUnlockedAccount } from '@/lib/accountLock'

const BALANCE_VISIBLE_KEY = 'banking-dashboard-balance-visible'
const SELECTED_ACCOUNT_KEY = 'banking-dashboard-selected-account'

/** Recent transactions: API page size; list scrolls inside a fixed viewport below. */
const DASHBOARD_RECENT_TX_PAGE_SIZE = 12
/** Viewport shows ~6 compact rows (+ space-y-0.5 gaps); inner list scrolls for up to PAGE_SIZE items. */
const DASHBOARD_RECENT_TX_SCROLL_HEIGHT = 'h-[268px] max-h-[268px]'

type DashboardAccount = {
  id: string
  account_number: string
  iban?: string | null
  account_type: string
  balance: string
  is_primary?: boolean
  currency?: { symbol?: string }
}

type ActivityTx = {
  amount: string
  created_at: string
  from_account?: string | null
  to_account?: string | null
  status?: string
}

function buildActivityChartData(
  rows: ActivityTx[],
  accountId: string | undefined,
): { day: string; credit: number; debit: number }[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    keys.push(d.toLocaleDateString('en-CA'))
  }
  const buckets = new Map<string, { label: string; credit: number; debit: number }>()
  for (const k of keys) {
    const [y, m, day] = k.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    buckets.set(k, {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      credit: 0,
      debit: 0,
    })
  }
  if (!accountId) {
    return keys.map((k) => {
      const b = buckets.get(k)!
      return { day: b.label, credit: 0, debit: 0 }
    })
  }
  for (const tx of rows) {
    if (tx.status && tx.status !== 'COMPLETED') continue
    const txDate = new Date(tx.created_at)
    const k = txDate.toLocaleDateString('en-CA')
    const b = buckets.get(k)
    if (!b) continue
    const amt = parseFloat(tx.amount) || 0
    if (amt <= 0) continue
    if (tx.to_account === accountId) b.credit += amt
    if (tx.from_account === accountId) b.debit += amt
  }
  return keys.map((k) => {
    const b = buckets.get(k)!
    return { day: b.label, credit: b.credit, debit: b.debit }
  })
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const authReady = useAuthReady()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLgUp = useIsLgUp()
  const [balanceVisible, setBalanceVisible] = useState(() => {
    try {
      return localStorage.getItem(BALANCE_VISIBLE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(BALANCE_VISIBLE_KEY, String(balanceVisible))
    } catch {
      // ignore
    }
  }, [balanceVisible])

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [detailTransaction, setDetailTransaction] = useState<TransactionListItem | null>(null)

  const { data: accountsRes, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
    enabled: authReady,
  })

  const { data: txRes, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 'recent-dashboard', DASHBOARD_RECENT_TX_PAGE_SIZE],
    queryFn: () => transactionsApi.list({ page_size: DASHBOARD_RECENT_TX_PAGE_SIZE }),
    enabled: authReady,
  })

  const accounts = fromApiListResponse<DashboardAccount>(accountsRes)
  const transactions = fromApiListResponse<TransactionListItem>(txRes)

  const primaryAccount = useMemo(
    () => accounts.find((a) => a.is_primary) ?? accounts[0],
    [accounts],
  )

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null)
      return
    }
    let stored: string | null = null
    try {
      stored = localStorage.getItem(SELECTED_ACCOUNT_KEY)
    } catch {
      stored = null
    }
    const storedValid = stored && accounts.some((a) => a.id === stored)
    const fallbackId = primaryAccount?.id ?? accounts[0].id
    const nextId = storedValid ? stored! : fallbackId
    setSelectedAccountId((prev) => (prev && accounts.some((a) => a.id === prev) ? prev : nextId))
  }, [accounts, primaryAccount?.id])

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined
    return accounts.find((a) => a.id === selectedAccountId) ?? primaryAccount
  }, [accounts, selectedAccountId, primaryAccount])

  const activeAccountId = activeAccount?.id

  const userAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts])

  const detailTransactionIsCredit = useMemo(
    () => (detailTransaction ? isCreditForUser(detailTransaction, userAccountIds) : false),
    [detailTransaction, userAccountIds],
  )

  const { data: activityTxRes, isLoading: activityLoading } = useQuery({
    queryKey: ['transactions', 'activity-week', activeAccountId],
    queryFn: () => {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return transactionsApi.list({
        page_size: 500,
        start_date: start.toISOString(),
      })
    },
    enabled: Boolean(activeAccountId) && isLgUp,
  })

  const activityRows = fromApiListResponse<ActivityTx>(activityTxRes)

  const activityChartData = useMemo(
    () => buildActivityChartData(activityRows, activeAccountId),
    [activityRows, activeAccountId],
  )

  const { weekCredit, weekDebit, weekVolume } = useMemo(() => {
    const c = activityChartData.reduce((s, d) => s + d.credit, 0)
    const d = activityChartData.reduce((s, row) => s + row.debit, 0)
    return { weekCredit: c, weekDebit: d, weekVolume: c + d }
  }, [activityChartData])

  const setActiveAccount = (id: string) => {
    setSelectedAccountId(id)
    try {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, id)
    } catch {
      // ignore
    }
  }

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => accountsApi.update(id, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Default account for this device updated.')
    },
    onError: () => toast.error('Could not update default account.'),
  })

  const activeBalance = activeAccount ? parseFloat(activeAccount.balance || '0') : 0
  const balanceDisplay = balanceVisible ? formatCurrency(activeBalance) : '••••••••'

  const balanceLeading =
    activeAccount != null ? (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {formatAccountTypeLabel(activeAccount.account_type)}
        </p>
        <p className="font-mono text-base font-semibold text-white tracking-[0.12em] leading-snug sm:text-lg">
          {formatAccountIdentifierDisplay(activeAccount)}
        </p>
      </div>
    ) : null

  const balanceCardMeta =
    activeAccount == null ? (
      <p className="text-white/50 text-xs">No account linked yet.</p>
    ) : accounts.length > 1 ? (
      <div className="space-y-2">
        <div className="relative max-w-md">
          <label className="sr-only">Account to display</label>
          <select
            value={activeAccount.id}
            onChange={(e) => setActiveAccount(e.target.value)}
            className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 py-2 pl-3 pr-9 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="text-gray-900">
                {formatAccountTypeLabel(a.account_type)} · ••••{accountIdentifierLastFour(a)}
                {a.is_primary ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55"
          />
        </div>
        {activeAccount.id !== primaryAccount?.id ? (
          <button
            type="button"
            onClick={() => setPrimaryMutation.mutate(activeAccount.id)}
            disabled={setPrimaryMutation.isPending}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
          >
            Make this my default account
          </button>
        ) : null}
      </div>
    ) : undefined

  const panelClass =
    'overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_20px_-8px_rgba(21,42,30,0.06)]'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dashboard</p>
        <p className="mt-0.5 text-sm text-gray-600">
          Overview · updated {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Balance card */}
        <div className="lg:col-span-2">
          <StatCard
            compact
            className="!rounded-2xl !border-primary-dark/20 !p-4 !shadow-[0_8px_28px_-10px_rgba(21,42,30,0.35)] lg:!p-5"
            label="Balance"
            value={balanceDisplay}
            leading={balanceLeading ?? undefined}
            meta={balanceCardMeta}
            valueTrailing={
              <button
                type="button"
                onClick={() => setBalanceVisible((v) => !v)}
                className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
              >
                {balanceVisible ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
              </button>
            }
            trend={{ value: '+2.4% from last month', positive: true }}
            accent
          >
            <button
              type="button"
              onClick={() => {
                if (!guardUnlockedAccount()) return
                navigate('/transactions/transfer')
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-primary-dark shadow-sm transition-colors hover:bg-accent-dark sm:text-sm sm:px-5 sm:py-2.5"
            >
              Send Money <ArrowUpRight size={14} />
            </button>
          </StatCard>
        </div>

        {/* Activity chart: credit vs debit per day (desktop only) */}
        <div className={cn(panelClass, 'hidden !p-4 lg:block')}>
          <div className="mb-0.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">7-day activity</p>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Last 7 days</span>
          </div>
          {activityLoading && activeAccountId ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              <p className="mb-0 text-lg font-bold text-gray-900 lg:text-xl">
                {formatCurrency(weekVolume, 'USD', DISPLAY_CURRENCY_SYMBOL)}
              </p>
              <p className="mb-5 text-[11px] lg:mb-6 lg:text-xs">
                <span className="font-medium text-emerald-600">
                  {formatCurrency(weekCredit, 'USD', DISPLAY_CURRENCY_SYMBOL)}
                </span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="font-medium text-slate-700">
                  {formatCurrency(weekDebit, 'USD', DISPLAY_CURRENCY_SYMBOL)}
                </span>
              </p>
              <div className="mt-1">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={activityChartData} barGap={2} barCategoryGap="14%" margin={{ top: 8, right: 2, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(200,240,0,0.06)' }}
                      contentStyle={{ border: 'none', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, 'USD', DISPLAY_CURRENCY_SYMBOL),
                        name === 'credit' ? 'Credit' : 'Debit',
                      ]}
                    />
                    <Bar dataKey="credit" name="credit" fill="#C8F000" radius={[2, 2, 0, 0]} maxBarSize={12} />
                    <Bar dataKey="debit" name="debit" fill="#152A1E" radius={[2, 2, 0, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={cn(panelClass, 'flex flex-col !p-4 lg:col-span-2')}>
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent transactions</h2>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary-dark transition hover:bg-gray-50"
              >
                View all →
              </button>
            </div>
            {txLoading ? (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center overflow-hidden py-8',
                  `${DASHBOARD_RECENT_TX_SCROLL_HEIGHT} py-0`,
                )}
              >
                <Spinner />
              </div>
            ) : transactions.length === 0 ? (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center overflow-hidden py-8',
                  `${DASHBOARD_RECENT_TX_SCROLL_HEIGHT} py-0`,
                )}
              >
                <p className="text-center text-sm text-gray-400">No transactions yet.</p>
              </div>
            ) : (
              <>
                <div className={cn('shrink-0 overflow-hidden', DASHBOARD_RECENT_TX_SCROLL_HEIGHT)}>
                  <div
                    className={cn(
                      'space-y-0.5',
                      'h-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin]',
                    )}
                  >
                    {transactions
                      .slice(0, DASHBOARD_RECENT_TX_PAGE_SIZE)
                      .map((tx: Parameters<typeof TransactionRow>[0]['transaction']) => (
                        <TransactionRow
                          key={tx.id}
                          compact
                          hideStatus={!isLgUp}
                          transaction={tx}
                          accountId={activeAccount?.id}
                          onClick={() => setDetailTransaction(tx as TransactionListItem)}
                        />
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-4 lg:min-h-0">
            <div className={cn(panelClass, 'flex min-h-0 flex-1 flex-col !p-4')}>
              <div className="mb-3 flex shrink-0 items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-sm font-semibold text-gray-900">My cards</h2>
                <button
                  type="button"
                  onClick={() => navigate('/cards')}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-primary-dark transition hover:bg-gray-50"
                >
                  Manage
                </button>
              </div>
              {accountsLoading ? (
                <div className="flex flex-1 items-center justify-center py-3">
                  <Spinner size="sm" />
                </div>
              ) : activeAccount ? (
                <div className="flex w-full shrink-0 justify-center">
                  <CardWidget
                    compact
                    accountNumber={maskAccountIdentifier(activeAccount)}
                    cardHolder={user?.full_name || 'ACCOUNT HOLDER'}
                    accountType={formatAccountTypeLabel(activeAccount.account_type)}
                    balance={activeAccount.balance}
                    currencySymbol={DISPLAY_CURRENCY_SYMBOL}
                  />
                </div>
              ) : (
                <p className="flex flex-1 items-center justify-center py-3 text-center text-sm text-gray-400">No accounts yet.</p>
              )}

              <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
                {[
                  { icon: Lock, label: 'Freeze card', description: 'Pause spending' },
                  { icon: SlidersHorizontal, label: 'Limits', description: 'Monthly cap' },
                ].map(({ icon: Icon, label, description }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate('/cards')}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 text-center transition hover:border-gray-200 hover:bg-white"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary-dark shadow-sm">
                      <Icon size={14} strokeWidth={2} />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-[10px] text-gray-500">{description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto shrink-0 pt-2 lg:pt-3">
          <LoanOffersMarquee />
        </div>
      </div>

      <TransactionDetailDrawer
        transaction={detailTransaction}
        isCredit={detailTransactionIsCredit}
        onClose={() => setDetailTransaction(null)}
      />
    </div>
  )
}
