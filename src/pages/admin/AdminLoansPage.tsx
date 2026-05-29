import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, CreditCard, X } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import AdminLoanProductsTab from '@/pages/admin/AdminLoanProductsTab'

type Tab = 'applications' | 'products'

type LoanRow = {
  id: string
  applicant_name: string
  product_name: string
  requested_amount: string
  term_months: number
  status: string
}

function loanStatusClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'REJECTED':
      return 'bg-red-50 text-red-800 ring-red-100'
    case 'DISBURSED':
      return 'bg-sky-50 text-sky-800 ring-sky-100'
    default:
      return 'bg-amber-50 text-amber-900 ring-amber-100'
  }
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function AdminLoansPage() {
  const [tab, setTab] = useState<Tab>('applications')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-loans'],
    queryFn: () => adminApi.loans(),
    enabled: tab === 'applications',
  })
  const loans = (data?.data?.results || data?.data || []) as LoanRow[]

  const summary = useMemo(() => {
    const submitted = loans.filter((l) => l.status === 'SUBMITTED').length
    return { total: loans.length, submitted }
  }, [loans])

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => adminApi.reviewLoan(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-loans'] })
      toast.success('Decision saved.')
    },
    onError: () => toast.error('Failed to process decision.'),
  })

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <CreditCard size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Loans</h1>
            <p className="hidden text-xs text-gray-500 sm:block">Applications and customer-facing loan products</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {tab === 'applications' && !isLoading && loans.length > 0 ? (
            <p className="text-xs font-semibold tabular-nums text-gray-500">
              {summary.total} {summary.total === 1 ? 'application' : 'applications'}
              {summary.submitted > 0 ? (
                <>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-amber-800">{summary.submitted} pending review</span>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50/80 p-0.5 sm:w-auto">
            <button
              type="button"
              onClick={() => setTab('applications')}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none sm:py-1.5',
                tab === 'applications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              Applications
            </button>
            <button
              type="button"
              onClick={() => setTab('products')}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none sm:py-1.5',
                tab === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              Loan products
            </button>
          </div>
        </div>
      </section>

      {tab === 'products' ? (
        <AdminLoanProductsTab />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Spinner />
            </div>
          ) : loans.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <CreditCard size={32} className="mx-auto text-gray-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-gray-700">No loan applications</p>
              <p className="mt-1 text-xs text-gray-500">New applications will appear here for review.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3 p-3 md:hidden sm:p-4">
                {loans.map((loan) => (
                  <AdminMobileCard
                    key={loan.id}
                    className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_2px_16px_-6px_rgba(21,42,30,0.1)]"
                  >
                    <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-dark text-xs font-bold text-accent shadow-sm"
                          aria-hidden
                        >
                          {userInitials(loan.applicant_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">{loan.applicant_name}</p>
                              <p className="mt-0.5 text-sm text-gray-600">{loan.product_name}</p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                                loanStatusClass(loan.status),
                              )}
                            >
                              {loan.status}
                            </span>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount</p>
                              <p className="text-base font-bold tabular-nums text-gray-900">
                                {formatDisplayCurrency(loan.requested_amount)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Term</p>
                              <p className="text-sm font-semibold tabular-nums text-gray-700">{loan.term_months} mo</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {loan.status === 'SUBMITTED' ? (
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: loan.id, decision: 'APPROVE' })}
                            className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-2 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <Check size={14} aria-hidden />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ id: loan.id, decision: 'REJECT' })}
                            className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-red-200/90 bg-red-50/80 px-2.5 py-2 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
                          >
                            <X size={14} aria-hidden />
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </AdminMobileCard>
                ))}
              </ul>

              <div className="admin-table-scroll hidden md:block">
                <table className="admin-data-table min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-2.5 sm:px-6">Applicant</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5">Term</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loans.map((loan, i) => (
                      <tr
                        key={loan.id}
                        className={cn('transition-colors hover:bg-emerald-50/30', i % 2 === 1 && 'bg-gray-50/40')}
                      >
                        <td className="px-4 py-3.5 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-dark/[0.08] text-[10px] font-bold text-primary-dark ring-1 ring-primary-dark/10"
                              aria-hidden
                            >
                              {userInitials(loan.applicant_name)}
                            </div>
                            <span className="font-medium text-gray-900">{loan.applicant_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-gray-700">{loan.product_name}</td>
                        <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                          {formatDisplayCurrency(loan.requested_amount)}
                        </td>
                        <td className="px-3 py-3.5 tabular-nums text-gray-600">{loan.term_months} mo</td>
                        <td className="px-3 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                              loanStatusClass(loan.status),
                            )}
                          >
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6">
                          {loan.status === 'SUBMITTED' ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="Approve"
                                disabled={reviewMutation.isPending}
                                onClick={() => reviewMutation.mutate({ id: loan.id, decision: 'APPROVE' })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-emerald-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <Check size={15} aria-hidden />
                                <span className="sr-only">Approve {loan.applicant_name}</span>
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                disabled={reviewMutation.isPending}
                                onClick={() => reviewMutation.mutate({ id: loan.id, decision: 'REJECT' })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                              >
                                <X size={15} aria-hidden />
                                <span className="sr-only">Reject {loan.applicant_name}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!isLoading && loans.length > 0 ? (
            <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-center text-[11px] text-gray-500">
              Showing {loans.length} {loans.length === 1 ? 'application' : 'applications'}
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
