import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  KeyRound,
  ChevronRight,
  CreditCard,
  Gauge,
  FileText,
  ShieldAlert,
  Snowflake,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { cardsApi, type CardSummaryRow } from '@/api/cards'
import { useAuthStore } from '@/store/authStore'
import RequestReplacementModal from '@/components/cards/RequestReplacementModal'
import CardWidget from '@/components/ui/CardWidget'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { DISPLAY_CURRENCY_SYMBOL } from '@/utils/format'
import { formatAccountIdentifierDisplay, maskAccountIdentifier } from '@/lib/uaeAccount'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import { cardTierLabel, cardVariantFromTier } from '@/lib/cardTier'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-gray-200')}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}

export default function CardsPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, { frozen: boolean; limitOn: boolean }>>({})
  const [replacementModal, setReplacementModal] = useState<{ accountId: string; issueFee: string } | null>(null)

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['cards-summary'],
    queryFn: () => cardsApi.summary(),
  })
  const { data: profileRes } = useQuery({ queryKey: ['profile'], queryFn: () => authApi.getProfile() })

  const rows: CardSummaryRow[] = Array.isArray(summaryRes?.data) ? summaryRes.data : []
  const profile = profileRes?.data as { address?: string } | undefined

  const deliveryAddress = useMemo(() => {
    const raw = profile?.address?.trim()
    if (raw) return raw.replace(/\n/g, ', ')
    return 'Add your address in Settings → Personal'
  }, [profile])

  const selectedRow = useMemo(() => {
    if (rows.length === 0) return undefined
    const id = selectedAccountId || (rows[0].account as { id: string }).id
    return rows.find((r) => (r.account as { id: string }).id === id) || rows[0]
  }, [rows, selectedAccountId])

  const selectedAccount = selectedRow?.account as
    | {
        id: string
        account_number: string
        iban?: string | null
        account_type: string
        balance: string
        available_balance: string
      }
    | undefined

  const selectedPrefs = selectedAccount
    ? prefs[selectedAccount.id] || { frozen: false, limitOn: true }
    : { frozen: false, limitOn: true }

  const requestMutation = useMutation({
    mutationFn: (accountId: string) => cardsApi.request(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Card request created. Pay the issuance fee to activate.')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Could not request card.')
    },
  })

  const replacementMutation = useMutation({
    mutationFn: ({ accountId, terminatePrevious }: { accountId: string; terminatePrevious: boolean }) =>
      cardsApi.requestReplacement(accountId, terminatePrevious),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setReplacementModal(null)
      toast.success('Replacement requested. Pay the fee to activate your new card.')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Could not request replacement.')
    },
  })

  const payMutation = useMutation({
    mutationFn: (issuanceId: string) => cardsApi.payFee(issuanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Card fee paid. Your card is now active.')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Payment failed.')
    },
  })

  const setPref = (key: 'frozen' | 'limitOn', value: boolean) => {
    if (!selectedAccount) return
    setPrefs((p) => ({
      ...p,
      [selectedAccount.id]: { ...selectedPrefs, [key]: value },
    }))
    if (key === 'frozen') toast(value ? 'Card frozen.' : 'Card unfrozen.')
    else toast(value ? 'Spending limit on.' : 'Spending limit paused.')
  }

  const issuance = selectedRow?.issuance
  const isActive = issuance?.status === 'ACTIVE'
  const isPending = issuance?.status === 'PENDING_PAYMENT'

  const monthlyCap = issuance
    ? parseFloat(issuance.monthly_spending_limit || '0')
    : parseFloat(selectedRow?.product?.monthly_spending_limit || '5000')
  const monthSpend = selectedRow ? parseFloat(selectedRow.current_month_spend || '0') : 0
  const pct = monthlyCap > 0 ? Math.min(100, (monthSpend / monthlyCap) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="flex flex-col gap-3 bg-primary-dark px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Cards</h1>
            <p className="mt-0.5 text-sm text-white/75">One card per linked account · pay fee to activate</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/accounts')}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Manage accounts
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-14 text-center">
              <CreditCard className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-900">No accounts to link</p>
              <p className="mt-1 text-sm text-gray-500">Open an account first, then request a card.</p>
              <button type="button" onClick={() => navigate('/accounts')} className="btn-primary mt-4 text-sm">
                Go to accounts
              </button>
            </div>
          ) : (
            <>
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Linked accounts</p>
                <div className="-mx-1 flex justify-center gap-4 overflow-x-auto px-1 pb-1">
                  {rows.map((row) => {
                    const acc = row.account as {
                      id: string
                      account_number: string
        iban?: string | null
                      account_type: string
                      balance: string
                    }
                    const iss = row.issuance
                    const active = selectedAccount?.id === acc.id
                    const v = cardVariantFromTier(iss?.card_tier || row.product?.card_tier)
                    const label = `${cardTierLabel(iss?.card_tier || row.product?.card_tier)} · ${formatAccountTypeLabel(acc.account_type)}`
                    const showRequest = !iss
                    const showPay = iss?.status === 'PENDING_PAYMENT'
                    const showReplacement = iss?.status === 'ACTIVE'
                    return (
                      <div key={acc.id} className="flex w-[min(100vw-2.5rem,24rem)] shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={cn(
                            'block w-full rounded-2xl text-left transition-all',
                            active ? 'ring-2 ring-primary-dark ring-offset-2' : 'opacity-90 hover:opacity-100',
                          )}
                        >
                          <CardWidget
                            variant={v}
                            accountNumber={maskAccountIdentifier(acc)}
                            cardHolder={user?.full_name || 'CARD HOLDER'}
                            accountType={label}
                            balance={acc.balance}
                            currencySymbol={DISPLAY_CURRENCY_SYMBOL}
                            className="w-full max-w-none"
                          />
                        </button>
                        {(showRequest || showPay || showReplacement) && (
                          <div className="mt-2 flex justify-center">
                            {showRequest ? (
                              <button
                                type="button"
                                disabled={requestMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  requestMutation.mutate(acc.id)
                                }}
                                className="btn-primary py-1.5 text-[11px] uppercase tracking-wide disabled:opacity-50"
                              >
                                Request card
                              </button>
                            ) : showPay ? (
                              <button
                                type="button"
                                disabled={payMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  payMutation.mutate(iss!.id)
                                }}
                                className="rounded-full bg-accent px-4 py-1.5 text-[11px] font-bold uppercase text-primary-dark disabled:opacity-50"
                              >
                                Pay {DISPLAY_CURRENCY_SYMBOL}
                                {parseFloat(iss!.issue_fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={replacementMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReplacementModal({
                                    accountId: acc.id,
                                    issueFee: row.product?.issue_fee || iss!.issue_fee || '0',
                                  })
                                }}
                                className="rounded-full border border-gray-200 px-4 py-1.5 text-[11px] font-bold uppercase text-primary-dark hover:bg-gray-50 disabled:opacity-50"
                              >
                                Replacement
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {selectedAccount && selectedRow ? (
                <section className="space-y-5 border-t border-gray-100 pt-6">
                  {!isActive ? (
                    <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                      {isPending
                        ? 'Pay the issuance fee using the button under your card preview.'
                        : `Request a card · fee ${DISPLAY_CURRENCY_SYMBOL}${parseFloat(selectedRow.product?.issue_fee || '0').toFixed(2)}`}
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={cn('flex items-center justify-between rounded-xl border border-gray-100 p-4', !isActive && 'opacity-50')}>
                      <div className="flex items-center gap-3">
                        <Snowflake size={18} className="text-primary-dark" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Freeze card</p>
                          <p className="text-xs text-gray-500">Block purchases</p>
                        </div>
                      </div>
                      <Toggle checked={selectedPrefs.frozen} onChange={(v) => setPref('frozen', v)} />
                    </div>
                    <div className={cn('flex items-center justify-between rounded-xl border border-gray-100 p-4', !isActive && 'opacity-50')}>
                      <div className="flex items-center gap-3">
                        <Gauge size={18} className="text-primary-dark" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Spending limit</p>
                          <p className="text-xs text-gray-500">Monthly cap</p>
                        </div>
                      </div>
                      <Toggle checked={selectedPrefs.limitOn} onChange={(v) => setPref('limitOn', v)} />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className={cn('rounded-xl border border-gray-100 p-4', !isActive && 'opacity-60')}>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Card details</p>
                      {!isActive ? (
                        <p className="text-sm text-gray-500">Available after activation.</p>
                      ) : (
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between gap-2 border-b border-gray-50 py-2">
                            <dt className="text-gray-500">Number</dt>
                            <dd className="font-mono text-gray-900">{formatAccountIdentifierDisplay(selectedAccount)}</dd>
                          </div>
                          <div className="flex justify-between gap-2 border-b border-gray-50 py-2">
                            <dt className="text-gray-500">Expires</dt>
                            <dd>12 / 28</dd>
                          </div>
                          <div className="flex justify-between gap-2 py-2">
                            <dt className="text-gray-500">Billing</dt>
                            <dd className="max-w-[55%] text-right text-xs">{deliveryAddress}</dd>
                          </div>
                        </dl>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-100 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">This month</p>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-600">Spent</span>
                        <span className="font-semibold tabular-nums">
                          {DISPLAY_CURRENCY_SYMBOL}
                          {monthSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })} /{' '}
                          {DISPLAY_CURRENCY_SYMBOL}
                          {monthlyCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-4 divide-y divide-gray-50">
                        {[
                          { icon: KeyRound, label: 'Change PIN', onClick: () => toast('Use the mobile app or support.', { icon: 'ℹ️' }) },
                          { icon: ShieldAlert, label: 'Report lost or stolen', onClick: () => toast('Contact support.', { icon: '💬' }) },
                          { icon: FileText, label: 'Statements', onClick: () => navigate('/transactions') },
                        ].map(({ icon: Icon, label, onClick }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={onClick}
                            disabled={!isActive}
                            className="flex w-full items-center gap-3 py-3 text-left hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Icon size={16} className="text-gray-500" />
                            <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
                            <ChevronRight size={16} className="text-gray-300" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={() => navigate(`/accounts/${selectedAccount.id}`)} className="btn-outline text-sm">
                    Open linked account
                  </button>
                </section>
              ) : null}

              <RequestReplacementModal
                open={!!replacementModal}
                onClose={() => setReplacementModal(null)}
                currencySymbol={DISPLAY_CURRENCY_SYMBOL}
                issueFee={replacementModal?.issueFee ?? '0'}
                onConfirm={(terminatePrevious) => {
                  if (replacementModal) {
                    replacementMutation.mutate({ accountId: replacementModal.accountId, terminatePrevious })
                  }
                }}
                isSubmitting={replacementMutation.isPending}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
