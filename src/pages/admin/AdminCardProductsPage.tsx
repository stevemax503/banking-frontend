import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, Layers, Loader2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import Spinner from '@/components/ui/Spinner'
import { selectShell } from '@/components/forms/StyledSelect'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import { cn } from '@/utils/cn'

type CardProduct = {
  id: string
  account_type: string
  card_tier: string
  issue_fee: string
  monthly_spending_limit: string
  is_active: boolean
}

const TIERS = [
  { value: 'STANDARD', label: 'Standard (Visa Debit)' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'CREDIT_LINE', label: 'Credit-line design' },
] as const

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

const compactInputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium tabular-nums text-gray-900 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

export default function AdminCardProductsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-card-products'],
    queryFn: adminApi.cardProducts,
  })
  const raw = data?.data as { results?: CardProduct[] } | CardProduct[] | undefined
  const products: CardProduct[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminApi.updateCardProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-products'] })
      toast.success('Card product saved.')
    },
    onError: () => toast.error('Could not save.'),
  })

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Layers size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Card products</h1>
            <p className="text-xs text-gray-500">Issuance fees and spending caps by account type</p>
          </div>
        </div>
        {!isLoading && products.length > 0 ? (
          <p className="text-xs font-semibold tabular-nums text-gray-500">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-4 py-3 sm:px-6">
          <p className="text-xs leading-relaxed text-gray-500">
            Set the one-time issue fee and monthly spending limit for each account type. Customers see these when
            requesting a card.
          </p>
        </div>

        <div className="admin-table-scroll">
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Spinner />
            </div>
          ) : products.length === 0 ? (
            <div className="py-14 text-center">
              <Layers size={32} className="mx-auto text-gray-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-gray-700">No card products configured</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5 sm:px-6">Account type</th>
                  <th className="px-3 py-2.5">Card tier</th>
                  <th className="px-3 py-2.5">Issue fee</th>
                  <th className="px-3 py-2.5">Monthly limit</th>
                  <th className="px-4 py-2.5 sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p, i) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    zebra={i % 2 === 1}
                    isSaving={updateMutation.isPending && updateMutation.variables?.id === p.id}
                    onSave={(payload) => updateMutation.mutate({ id: p.id, payload })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && products.length > 0 ? (
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500">
            Edit a row and click Save to update customer-facing card options
          </div>
        ) : null}
      </section>
    </div>
  )
}

function ProductRow({
  product,
  zebra,
  isSaving,
  onSave,
}: {
  product: CardProduct
  zebra: boolean
  isSaving: boolean
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [fee, setFee] = useState(product.issue_fee)
  const [cap, setCap] = useState(product.monthly_spending_limit)
  const [tier, setTier] = useState(product.card_tier)
  const [active, setActive] = useState(product.is_active)

  useEffect(() => {
    setFee(product.issue_fee)
    setCap(product.monthly_spending_limit)
    setTier(product.card_tier)
    setActive(product.is_active)
  }, [product])

  const dirty =
    fee !== product.issue_fee ||
    cap !== product.monthly_spending_limit ||
    tier !== product.card_tier ||
    active !== product.is_active

  return (
    <tr className={cn('align-middle transition-colors hover:bg-emerald-50/25', zebra && 'bg-gray-50/40')}>
      <td className="px-4 py-3.5 sm:px-6">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
            accountTypeBadge(product.account_type),
          )}
        >
          {formatAccountTypeLabel(product.account_type)}
        </span>
      </td>
      <td className="px-3 py-3.5">
        <div className={cn(selectShell, 'max-w-[13rem]')}>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-xl bg-transparent py-2 pl-3 pr-9 text-xs font-medium text-gray-900 focus:outline-none"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-2 flex w-5 items-center justify-center text-gray-500"
            aria-hidden
          >
            <ChevronDown size={14} />
          </span>
        </div>
      </td>
      <td className="px-3 py-3.5">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className={cn(compactInputClass, 'max-w-[6.5rem]')}
          aria-label={`Issue fee for ${product.account_type}`}
        />
      </td>
      <td className="px-3 py-3.5">
        <input
          type="number"
          step="1"
          min="0"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className={cn(compactInputClass, 'max-w-[7.5rem]')}
          aria-label={`Monthly limit for ${product.account_type}`}
        />
      </td>
      <td className="px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset transition',
              active
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
                : 'bg-gray-100 text-gray-500 ring-gray-200',
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-gray-400')}
              aria-hidden
            />
            {active ? 'Active' : 'Off'}
          </button>
          <button
            type="button"
            disabled={!dirty || isSaving}
            onClick={() =>
              onSave({
                issue_fee: fee,
                monthly_spending_limit: cap,
                card_tier: tier,
                is_active: active,
              })
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition',
              dirty
                ? 'bg-primary-dark text-white hover:bg-primary-light'
                : 'cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-400',
              isSaving && 'opacity-70',
            )}
          >
            {isSaving ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}
