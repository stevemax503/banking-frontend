import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import LoanProductDetailModal from '@/components/loans/LoanProductDetailModal'
import { loansApi } from '@/api/loans'
import { guardUnlockedAccount } from '@/lib/accountLock'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency, formatDate } from '@/utils/format'
import {
  getLoanTypeVisual,
  loanTypeSortIndex,
  resolveLoanProductDisplay,
  LOAN_TYPE_ORDER,
  LOAN_TYPE_DISPLAY_NAMES,
  LOAN_CATALOG_LIMITS,
} from '@/lib/loanProductVisuals'

function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)) {
    return (payload as { results: unknown[] }).results
  }
  return []
}

type LoanProduct = {
  id: string
  name: string
  loan_type: string
  interest_rate: string
  min_amount: string
  max_amount: string
  min_term_months: number
  max_term_months: number
  description: string
  tagline?: string
  full_description?: string
  hero_image_url?: string | null
}

type LoanApplication = {
  id: string
  product_name: string
  requested_amount: string
  term_months: number
  status: string
  created_at: string
}

type LoanAccount = {
  id: string
  product_name: string
  principal_amount: string
  outstanding_balance: string
  monthly_payment: string
  next_payment_due: string | null
  status: string
}

type LoanCardRow = {
  key: string
  loan_type: string
  name: string
  brief: string
  heroImage: string
  tagline: string
  fullDescription: string
  apiProduct: LoanProduct
  limits: { min_amount: string; max_amount: string; min_term_months: number; max_term_months: number }
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-sky-50 text-sky-800',
  UNDER_REVIEW: 'bg-amber-50 text-amber-900',
  APPROVED: 'bg-emerald-50 text-emerald-800',
  REJECTED: 'bg-red-50 text-red-700',
  DISBURSED: 'bg-emerald-50 text-emerald-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export default function LoanProductsPage() {
  const navigate = useNavigate()
  const [modalCard, setModalCard] = useState<LoanCardRow | null>(null)

  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['loan-products'],
    queryFn: loansApi.products,
  })
  const { data: applicationsRes, isLoading: applicationsLoading } = useQuery({
    queryKey: ['loan-applications'],
    queryFn: loansApi.applications,
  })
  const { data: accountsRes } = useQuery({ queryKey: ['loan-accounts'], queryFn: loansApi.loanAccounts })

  const products = normalizeList(productsRes?.data) as LoanProduct[]
  const applications = normalizeList(applicationsRes?.data) as LoanApplication[]
  const loanAccounts = normalizeList(accountsRes?.data) as LoanAccount[]

  const loanCards = useMemo((): LoanCardRow[] => {
    const active = [...products].sort((a, b) => {
      const byType = loanTypeSortIndex(a.loan_type) - loanTypeSortIndex(b.loan_type)
      return byType !== 0 ? byType : a.name.localeCompare(b.name)
    })
    if (active.length > 0) {
      return active.map((api) => {
        const display = resolveLoanProductDisplay(api)
        const brief = api.description?.trim() || display.tagline
        return {
          key: api.id,
          loan_type: api.loan_type,
          name: api.name,
          brief,
          heroImage: display.heroImage,
          tagline: display.tagline,
          fullDescription: display.fullDescription,
          apiProduct: api,
          limits: {
            min_amount: api.min_amount,
            max_amount: api.max_amount,
            min_term_months: api.min_term_months,
            max_term_months: api.max_term_months,
          },
        }
      })
    }
    return LOAN_TYPE_ORDER.map((loan_type) => {
      const visual = getLoanTypeVisual(loan_type)
      const catalogLimits = LOAN_CATALOG_LIMITS[loan_type]
      return {
        key: loan_type,
        loan_type,
        name: LOAN_TYPE_DISPLAY_NAMES[loan_type],
        brief: visual.tagline,
        heroImage: visual.heroImage,
        tagline: visual.tagline,
        fullDescription: visual.fullDescription,
        apiProduct: {
          id: loan_type,
          name: LOAN_TYPE_DISPLAY_NAMES[loan_type],
          loan_type,
          interest_rate: '0',
          min_amount: catalogLimits.min_amount,
          max_amount: catalogLimits.max_amount,
          min_term_months: catalogLimits.min_term_months,
          max_term_months: catalogLimits.max_term_months,
          description: visual.tagline,
        },
        limits: catalogLimits,
      }
    })
  }, [products])

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="bg-primary-dark px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Loans</h1>
          <p className="mt-0.5 text-sm text-white/75">Apply for products · track requests and repayments</p>
        </div>

        <div className="space-y-8 p-4 sm:p-6">
          {loanAccounts.length > 0 ? (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Active loans</p>
              <ul className="flex flex-wrap justify-center gap-3">
                {loanAccounts.map((loan) => {
                  const principal = parseFloat(loan.principal_amount) || 0
                  const outstanding = parseFloat(loan.outstanding_balance) || 0
                  const paid = Math.max(0, principal - outstanding)
                  const pct = principal > 0 ? Math.min(100, Math.round((paid / principal) * 1000) / 10) : 0
                  return (
                    <li
                      key={loan.id}
                      className="w-full max-w-[min(100%,400px)] flex-[1_1_100%] sm:flex-[1_1_calc(50%-0.375rem)] lg:flex-[1_1_calc(33.333%-0.5rem)]"
                    >
                    <button
                      type="button"
                      onClick={() => navigate(`/loans/${loan.id}`)}
                      className="h-full w-full rounded-xl border border-gray-100 p-4 text-left transition hover:border-gray-200 hover:shadow-[0_4px_16px_-6px_rgba(21,42,30,0.1)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900">{loan.product_name}</p>
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', loan.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
                          {loan.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDisplayCurrency(loan.monthly_payment)}/mo
                        {loan.next_payment_due ? ` · Next ${formatDate(`${loan.next_payment_due}T12:00:00`)}` : ''}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {formatDisplayCurrency(paid)} paid · {formatDisplayCurrency(outstanding)} remaining
                      </p>
                    </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Your applications</p>
            {applicationsLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : applications.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-sm text-gray-500">
                No applications yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="hidden px-4 py-2.5 sm:table-cell">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{app.product_name}</td>
                        <td className="hidden px-4 py-3 tabular-nums sm:table-cell">{formatDisplayCurrency(app.requested_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', STATUS_BADGE[app.status] ?? STATUS_BADGE.DRAFT)}>
                            {statusLabel(app.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {app.status === 'APPROVED' ? (
                            <Link to={`/loans/applications/${app.id}/payout`} className="text-xs font-semibold text-primary-dark hover:underline">
                              Receive funds
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Available products</p>
            {productsLoading ? (
              <div className="flex justify-center py-14">
                <Spinner />
              </div>
            ) : (
              <ul className="flex flex-wrap justify-center gap-4">
                {loanCards.map((card) => (
                  <li
                    key={card.key}
                    className="w-full max-w-[min(100%,360px)] flex-[1_1_100%] sm:flex-[1_1_calc(50%-0.5rem)] lg:flex-[1_1_calc(33.333%-0.667rem)]"
                  >
                  <button
                    type="button"
                    onClick={() => setModalCard(card)}
                    className="group h-full w-full overflow-hidden rounded-xl border border-gray-100 bg-white text-left transition hover:border-gray-200 hover:shadow-[0_4px_20px_-8px_rgba(21,42,30,0.12)]"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img src={card.heroImage} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{card.loan_type.replace('_', ' ')}</p>
                        <h3 className="text-base font-bold text-white">{card.name}</h3>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs text-gray-600">{card.brief}</p>
                      <p className="mt-2 text-xs font-semibold text-primary-dark inline-flex items-center gap-1">
                        Details <ArrowRight size={14} />
                      </p>
                    </div>
                  </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <LoanProductDetailModal
        open={Boolean(modalCard)}
        product={
          modalCard
            ? {
                name: modalCard.name,
                loan_type: modalCard.loan_type,
                tagline: modalCard.tagline,
                heroImage: modalCard.heroImage,
                fullDescription: modalCard.fullDescription,
                interest_rate: modalCard.apiProduct.interest_rate,
                limits: modalCard.limits,
              }
            : null
        }
        onClose={() => setModalCard(null)}
        onApply={() => {
          if (!modalCard) return
          if (!guardUnlockedAccount()) return
          setModalCard(null)
          navigate(`/loans/apply/${modalCard.apiProduct.id}`)
        }}
      />
    </div>
  )
}
