import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Wallet, X } from 'lucide-react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { accountsApi } from '@/api/accounts'
import AccountTypeExploreCard from '@/components/accounts/AccountTypeExploreCard'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency } from '@/utils/format'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import {
  ACCOUNT_TYPES_ORDER,
  ACCOUNT_TYPE_MARKETING,
  type AccountTypeCode,
} from '@/lib/accountTypeMarketing'
import { formatAccountIdentifierDisplay } from '@/lib/uaeAccount'

type AccountRow = {
  id: string
  account_type: string
  account_number: string
  iban?: string | null
  balance: string
  available_balance: string
  status: string
  is_primary?: boolean
}

type CurrencyRow = { id: number; code: string; name: string; symbol: string }

export default function AccountListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [accountType, setAccountType] = useState<AccountTypeCode | ''>('')
  const [currencyId, setCurrencyId] = useState<number | ''>('')
  const [nickname, setNickname] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const { data: curRes } = useQuery({ queryKey: ['currencies'], queryFn: () => accountsApi.currencies() })

  const accounts: AccountRow[] = Array.isArray(data?.data?.results)
    ? data.data.results
    : Array.isArray(data?.data)
      ? data.data
      : []

  const currencies: CurrencyRow[] = Array.isArray(curRes?.data?.results)
    ? curRes.data.results
    : Array.isArray(curRes?.data)
      ? curRes.data
      : []

  const ownedTypes = useMemo(() => new Set(accounts.map((a) => a.account_type)), [accounts])

  const availableTypes = useMemo(
    () => ACCOUNT_TYPES_ORDER.filter((t) => !ownedTypes.has(t)),
    [ownedTypes],
  )

  const hasRoomForAnother = availableTypes.length > 0

  useEffect(() => {
    if (!modalOpen || availableTypes.length === 0) return
    setAccountType((prev) => (prev && availableTypes.includes(prev as AccountTypeCode) ? prev : availableTypes[0]))
  }, [modalOpen, availableTypes])

  useEffect(() => {
    if (currencies.length && currencyId === '') {
      setCurrencyId(currencies[0].id)
    }
  }, [currencies, currencyId])

  const createMutation = useMutation({
    mutationFn: (payload: { account_type: string; currency_id: number; nickname?: string }) =>
      accountsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('New account created.')
      setModalOpen(false)
      setNickname('')
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, string[] | string | undefined> } }
      const d = ax.response?.data
      let msg = 'Could not create account.'
      if (d?.account_type) {
        msg = Array.isArray(d.account_type) ? d.account_type[0] : String(d.account_type)
      } else if (typeof d?.detail === 'string') {
        msg = d.detail
      } else if (typeof d?.non_field_errors?.[0] === 'string') {
        msg = d.non_field_errors[0]
      }
      toast.error(msg)
    },
  })

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!accountType || currencyId === '') return
    createMutation.mutate({
      account_type: accountType,
      currency_id: Number(currencyId),
      nickname: nickname.trim() || undefined,
    })
  }

  function openModal(preselect?: AccountTypeCode) {
    if (!hasRoomForAnother) {
      toast.error('You already have every account type we offer.')
      return
    }
    if (preselect && availableTypes.includes(preselect)) {
      setAccountType(preselect)
    }
    setModalOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="flex flex-col gap-3 bg-primary-dark px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">My accounts</h1>
            <p className="mt-0.5 text-sm text-white/75">One account per product type · each has its own number</p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            disabled={!hasRoomForAnother}
            className={cn(
              'btn-primary inline-flex shrink-0 items-center gap-2 py-2.5 text-sm',
              !hasRoomForAnother && 'cursor-not-allowed opacity-50',
            )}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add account type
          </button>
        </div>

        <div className="space-y-10 p-4 sm:p-6">
          <section aria-labelledby="your-accounts-heading">
            <p id="your-accounts-heading" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your accounts
            </p>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-dark/10 text-primary-dark">
                  <Wallet size={24} strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">No accounts yet</p>
                <p className="mt-1 text-sm text-gray-500">Open your first account type below.</p>
                {hasRoomForAnother ? (
                  <button type="button" onClick={() => openModal()} className="btn-primary mt-4 text-sm">
                    Add account
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-wrap justify-center gap-3">
                {accounts.map((a) => (
                  <li
                    key={a.id}
                    className="w-full max-w-[min(100%,360px)] flex-[1_1_100%] sm:flex-[1_1_calc(50%-0.375rem)] lg:flex-[1_1_calc(33.333%-0.5rem)]"
                  >
                  <button
                    type="button"
                    onClick={() => navigate(`/accounts/${a.id}`)}
                    className="h-full w-full rounded-xl border border-gray-100 bg-white p-4 text-left transition hover:border-gray-200 hover:shadow-[0_4px_20px_-8px_rgba(21,42,30,0.12)]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {formatAccountTypeLabel(a.account_type)}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.is_primary ? (
                          <span className="rounded-md bg-accent/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-dark">
                            Default
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
                            a.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800'
                              : a.status === 'FROZEN'
                                ? 'bg-amber-50 text-amber-900'
                                : 'bg-red-50 text-red-700',
                          )}
                        >
                          {a.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">{formatDisplayCurrency(a.balance)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Available {formatDisplayCurrency(a.available_balance)}
                    </p>
                    <p className="mt-3 font-mono text-[11px] text-gray-400">{formatAccountIdentifierDisplay(a)}</p>
                  </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="explore-heading" className="border-t border-gray-100 pt-8">
            {!hasRoomForAnother && accounts.length > 0 ? (
              <p className="mb-4 rounded-xl border border-amber-100/90 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-950">
                You hold every account type we offer. Contact support if you need something else.
              </p>
            ) : null}
            <div className="mb-5 max-w-2xl">
              <p id="explore-heading" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Account types
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Compare what each product is for. You can hold one of each type with its own account number.
              </p>
            </div>
            <ul className="flex flex-wrap justify-center gap-5">
              {ACCOUNT_TYPES_ORDER.map((code) => (
                <li
                  key={code}
                  className="w-full max-w-[min(100%,360px)] flex-[1_1_100%] sm:flex-[1_1_calc(50%-0.625rem)] lg:flex-[1_1_calc(33.333%-0.833rem)]"
                >
                  <AccountTypeExploreCard
                    code={code}
                    marketing={ACCOUNT_TYPE_MARKETING[code]}
                    owned={ownedTypes.has(code)}
                    canAdd={hasRoomForAnother && availableTypes.includes(code)}
                    onAdd={() => openModal(code)}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" />
        <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
          <DialogPanel className="flex max-h-[min(90vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:rounded-2xl">
            <form onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between bg-primary-dark px-5 py-4">
                <DialogTitle className="text-lg font-bold text-white">Add account type</DialogTitle>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto px-5 py-5">
                <p className="text-sm text-gray-500">A new account number and IBAN will be assigned for this product.</p>
                <StyledSelect
                  label="Account type"
                  id="acct-type"
                  required
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountTypeCode)}
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {formatAccountTypeLabel(t)}
                    </option>
                  ))}
                </StyledSelect>
                <StyledSelect
                  label="Currency"
                  id="currency"
                  required
                  value={currencyId === '' ? '' : String(currencyId)}
                  onChange={(e) => setCurrencyId(Number(e.target.value))}
                >
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </StyledSelect>
                <div>
                  <label htmlFor="nick" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nickname <span className="font-normal normal-case text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="nick"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Holiday savings"
                    className="input-field w-full text-sm"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline flex-1 py-2.5 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !accountType || currencyId === ''}
                  className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  )
}
