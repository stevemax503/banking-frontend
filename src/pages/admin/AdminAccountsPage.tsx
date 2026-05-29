import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Wallet,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  AlertTriangle,
  Filter,
  Info,
  ChevronDown,
} from 'lucide-react'
import { adminApi } from '@/api/admin'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import { selectShell } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency } from '@/utils/format'
import {
  DEPOSIT_SOURCE_FIELDS,
  depositSourceComplete,
  emptyDepositSource,
  type DepositMethodKey,
} from '@/lib/depositSourceFields'

const DEPOSIT_METHODS = [
  { value: 'TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'WIRE', label: 'Wire' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'MOBILE', label: 'Mobile payment' },
  { value: 'OTHER', label: 'Other' },
] as const

const DEPOSIT_STATUSES = [
  { value: 'COMPLETED', label: 'Successful' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'FLAGGED', label: 'Flagged' },
] as const

type AccountRow = {
  id: string
  account_number: string
  owner_name: string
  account_type: string
  balance: string
  status: string
}

const emptyDepositForm = () => ({
  amount: '',
  description: '',
  deposit_method: 'TRANSFER' as DepositMethodKey,
  deposit_source: emptyDepositSource('TRANSFER'),
  status: 'COMPLETED',
})

function accountTypeBadge(type: string) {
  switch (type) {
    case 'CHECKING':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    case 'SAVINGS':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'BUSINESS':
      return 'bg-violet-50 text-violet-800 ring-violet-100'
    case 'CREDIT':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    case 'FIXED_TERM':
      return 'bg-gray-100 text-gray-700 ring-gray-200'
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'FROZEN':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    default:
      return 'bg-red-50 text-red-800 ring-red-100'
  }
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  )
}

function AccountSummary({ account }: { account: AccountRow }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2.5">
      <p className="font-mono text-[11px] text-gray-600">{account.account_number}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{account.owner_name}</p>
      <p className="mt-1 text-xs text-gray-500">
        Balance{' '}
        <span className="font-semibold tabular-nums text-gray-800">{formatDisplayCurrency(account.balance)}</span>
      </p>
    </div>
  )
}

function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon: typeof Wallet
  iconClassName?: string
  children: ReactNode
  footer: ReactNode
}) {
  if (!open) return null

  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,32rem)] flex-col overflow-hidden rounded-t-2xl border border-gray-200/90 bg-white shadow-[0_24px_48px_-12px_rgba(21,42,30,0.2)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-4',
                iconClassName ?? 'bg-primary-dark text-accent ring-primary-dark/10',
              )}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="admin-modal-title" className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:flex-row sm:px-5">{footer}</div>
      </div>
    </div>
  )
}

export default function AdminAccountsPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  const [depositTarget, setDepositTarget] = useState<AccountRow | null>(null)
  const [depositForm, setDepositForm] = useState(emptyDepositForm())
  const [adjustAccount, setAdjustAccount] = useState<AccountRow | null>(null)
  const [adjustForm, setAdjustForm] = useState({ operation: 'debit', amount: '', note: '' })
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-accounts', search],
    queryFn: () => adminApi.accounts({ search }),
  })
  const accounts = (data?.data?.results || data?.data || []) as AccountRow[]

  const depositAmountNum = parseFloat(depositForm.amount)
  const depositAmountValid = Number.isFinite(depositAmountNum) && depositAmountNum > 0

  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ['admin-deposit-preview', depositForm.amount],
    queryFn: () => adminApi.depositPreview(depositForm.amount),
    enabled: !!depositTarget && depositAmountValid,
  })

  const preview = previewData?.data as { amount?: string; fee?: string; net_credit?: string } | undefined

  const creditsAccount = depositForm.status === 'COMPLETED'
  const depositMethod = depositForm.deposit_method as DepositMethodKey
  const sourceFields = DEPOSIT_SOURCE_FIELDS[depositMethod] ?? []
  const sourceReady = depositSourceComplete(depositMethod, depositForm.deposit_source)

  const adjustMutation = useMutation({
    mutationFn: () => adminApi.adjustBalance(adjustAccount!.id, adjustForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      setAdjustAccount(null)
      toast.success('Balance adjusted.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed.'),
  })

  const depositMutation = useMutation({
    mutationFn: () =>
      adminApi.accountDeposit(depositTarget!.id, {
        amount: depositForm.amount,
        description: depositForm.description || 'Deposit',
        deposit_method: depositForm.deposit_method,
        deposit_source: depositForm.deposit_source,
        status: depositForm.status,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] })
      const ref = res.data?.transaction?.reference_number as string | undefined
      const fee = res.data?.fee as string | undefined
      setDepositTarget(null)
      setDepositForm(emptyDepositForm())
      toast.success(
        ref
          ? `Deposit recorded (${ref}).${fee && creditsAccount ? ` Fee ${formatDisplayCurrency(fee)} applied.` : ''}`
          : 'Deposit recorded.',
        { duration: 6000 },
      )
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Deposit failed.'),
  })

  const openDeposit = (account: AccountRow) => {
    setDepositTarget(account)
    setDepositForm(emptyDepositForm())
  }

  const closeDeposit = () => {
    setDepositTarget(null)
    setDepositForm(emptyDepositForm())
  }

  const selectedAccountLabel = useMemo(() => {
    if (!depositTarget) return ''
    return `${depositTarget.owner_name} · ····${depositTarget.account_number.slice(-4)}`
  }, [depositTarget])

  const searchField = (
    <div className={cn(selectShell, 'relative min-w-0 flex-1 sm:w-64')}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Account number or owner…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
    </div>
  )

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Wallet size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Accounts</h1>
        </div>
        {!isLoading && (
          <p className="text-xs font-semibold tabular-nums text-gray-500">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white">
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className={cn(
                selectShell,
                'mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between gap-2 px-3.5 py-2.5 text-left',
              )}
              aria-expanded={mobileFiltersOpen}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Filter size={15} className="text-primary-dark" aria-hidden />
                Search accounts
                {search.trim() ? (
                  <span className="rounded-full bg-primary-dark px-2 py-0.5 text-[10px] font-bold text-accent">
                    1
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={18}
                className={cn('shrink-0 text-gray-500 transition-transform', mobileFiltersOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            {mobileFiltersOpen ? <div className="px-4 pb-4 pt-3">{searchField}</div> : null}
          </div>

          <div className="hidden flex-wrap items-center justify-between gap-3 px-6 py-4 md:flex">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-dark">
              <Filter size={14} aria-hidden />
              Directory
            </div>
            {searchField}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Wallet size={32} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No accounts found</p>
            <p className="mt-1 text-xs text-gray-500">Try another search term.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 p-3 md:hidden sm:p-4">
              {accounts.map((a) => (
                <AdminMobileCard
                  key={a.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_2px_16px_-6px_rgba(21,42,30,0.1)]"
                >
                  <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{a.owner_name}</p>
                        <p className="mt-0.5 break-all font-mono text-[11px] text-gray-500">{a.account_number}</p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              accountTypeBadge(a.account_type),
                            )}
                          >
                            {a.account_type.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              statusBadgeClass(a.status),
                            )}
                          >
                            {a.status}
                          </span>
                        </div>
                      </div>
                      <p className="shrink-0 text-right text-base font-bold tabular-nums text-gray-900">
                        {formatDisplayCurrency(a.balance)}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => openDeposit(a)}
                        className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-2 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                      >
                        <ArrowDownToLine size={14} aria-hidden />
                        Deposit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustAccount(a)
                          setAdjustForm({ operation: 'debit', amount: '', note: '' })
                        }}
                        className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-red-200/90 bg-red-50/80 px-2.5 py-2 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                      >
                        <ArrowUpFromLine size={14} aria-hidden />
                        Debit
                      </button>
                    </div>
                  </div>
                </AdminMobileCard>
              ))}
            </ul>

            <div className="admin-table-scroll hidden md:block">
              <table className="admin-data-table min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5 sm:px-6">Account</th>
                    <th className="px-3 py-2.5">Owner</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Balance</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map((a, i) => (
                    <tr
                      key={a.id}
                      className={cn('transition-colors hover:bg-emerald-50/30', i % 2 === 1 && 'bg-gray-50/40')}
                    >
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-700 sm:px-6">{a.account_number}</td>
                      <td className="px-3 py-3.5 font-medium text-gray-900">{a.owner_name}</td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            accountTypeBadge(a.account_type),
                          )}
                        >
                          {a.account_type}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-semibold tabular-nums text-gray-900">
                        {formatDisplayCurrency(a.balance)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                            statusBadgeClass(a.status),
                          )}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 sm:px-6">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Deposit"
                            onClick={() => openDeposit(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                          >
                            <ArrowDownToLine size={15} aria-hidden />
                            <span className="sr-only">Deposit to {a.account_number}</span>
                          </button>
                          <button
                            type="button"
                            title="Debit"
                            onClick={() => {
                              setAdjustAccount(a)
                              setAdjustForm({ operation: 'debit', amount: '', note: '' })
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50"
                          >
                            <ArrowUpFromLine size={15} aria-hidden />
                            <span className="sr-only">Debit {a.account_number}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isLoading && accounts.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500 sm:px-6">
            Showing {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            {search.trim() ? ` matching “${search.trim()}”` : ''}
          </div>
        )}
      </section>

      <AdminModal
        open={!!depositTarget}
        onClose={closeDeposit}
        title="Deposit to account"
        subtitle={selectedAccountLabel}
        icon={ArrowDownToLine}
        iconClassName="bg-emerald-700 text-white ring-emerald-700/20"
        footer={
          <>
            <button type="button" onClick={closeDeposit} className="btn-outline flex-1 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => depositMutation.mutate()}
              disabled={
                !depositForm.amount || depositMutation.isPending || !depositAmountValid || !sourceReady
              }
              className="btn-primary flex-1 text-sm disabled:opacity-50"
            >
              {depositMutation.isPending ? 'Posting…' : 'Post deposit'}
            </button>
          </>
        }
      >
        {depositTarget ? (
          <div className="space-y-4">
            <AccountSummary account={depositTarget} />

            <div>
              <FieldLabel required>Amount</FieldLabel>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="input-field text-sm"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
              />
            </div>

            <div>
              <FieldLabel>Deposit type</FieldLabel>
              <select
                className="input-field text-sm"
                value={depositForm.deposit_method}
                onChange={(e) => {
                  const method = e.target.value as DepositMethodKey
                  setDepositForm({
                    ...depositForm,
                    deposit_method: method,
                    deposit_source: emptyDepositSource(method),
                  })
                }}
              >
                {DEPOSIT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Source details</p>
              <p className="-mt-1 text-[11px] text-gray-500">Shown in the customer transaction history</p>
              {sourceFields.map((field) => (
                <div key={field.key}>
                  <FieldLabel required={field.required}>{field.label}</FieldLabel>
                  {field.inputType === 'select' && field.options?.length ? (
                    <select
                      className="input-field text-sm"
                      value={depositForm.deposit_source[field.key] ?? ''}
                      onChange={(e) =>
                        setDepositForm({
                          ...depositForm,
                          deposit_source: {
                            ...depositForm.deposit_source,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">Select branch…</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input-field text-sm"
                      placeholder={field.placeholder}
                      value={depositForm.deposit_source[field.key] ?? ''}
                      onChange={(e) =>
                        setDepositForm({
                          ...depositForm,
                          deposit_source: {
                            ...depositForm.deposit_source,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div>
              <FieldLabel>Description</FieldLabel>
              <input
                className="input-field text-sm"
                placeholder="Optional — auto-generated if blank"
                value={depositForm.description}
                onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
              />
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                className="input-field text-sm"
                value={depositForm.status}
                onChange={(e) => setDepositForm({ ...depositForm, status: e.target.value })}
              >
                {DEPOSIT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 flex gap-1.5 rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-[11px] leading-snug text-gray-600">
                <Info size={14} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
                <span>
                  Only <strong>Successful</strong> credits the account (after deposit fee).{' '}
                  <strong>Failed</strong> posts deposit, reversal, fee, and fee reversal (balance unchanged).
                </span>
              </p>
            </div>

            {depositAmountValid ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-xs text-emerald-900">
                {previewLoading ? (
                  <span className="text-emerald-700/80">Calculating fee…</span>
                ) : preview ? (
                  <>
                    <p>
                      Deposit fee:{' '}
                      <span className="font-semibold">{formatDisplayCurrency(preview.fee ?? '0')}</span>
                    </p>
                    {creditsAccount ? (
                      <p className="mt-1">
                        Net credit:{' '}
                        <span className="font-semibold">{formatDisplayCurrency(preview.net_credit ?? '0')}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-800">Balance unchanged until status is Successful.</p>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={!!adjustAccount}
        onClose={() => setAdjustAccount(null)}
        title="Debit account"
        subtitle={
          adjustAccount
            ? `${adjustAccount.owner_name} · ····${adjustAccount.account_number.slice(-4)}`
            : undefined
        }
        icon={ArrowUpFromLine}
        iconClassName="bg-red-700 text-white ring-red-700/20"
        footer={
          <>
            <button type="button" onClick={() => setAdjustAccount(null)} className="btn-outline flex-1 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => adjustMutation.mutate()}
              disabled={!adjustForm.amount || !adjustForm.note || adjustMutation.isPending}
              className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
            >
              {adjustMutation.isPending ? 'Processing…' : 'Confirm debit'}
            </button>
          </>
        }
      >
        {adjustAccount ? (
          <div className="space-y-4">
            <AccountSummary account={adjustAccount} />

            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
              <p>
                Manual debits reduce the customer balance immediately. Use only for corrections or authorized
                adjustments — not standard withdrawals.
              </p>
            </div>

            <div>
              <FieldLabel required>Amount</FieldLabel>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="input-field text-sm"
                value={adjustForm.amount}
                onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
              />
            </div>

            <div>
              <FieldLabel required>Audit note</FieldLabel>
              <textarea
                rows={3}
                placeholder="Reason for this debit (required for audit trail)"
                className="input-field min-h-[4.5rem] resize-y text-sm"
                value={adjustForm.note}
                onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
              />
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  )
}
