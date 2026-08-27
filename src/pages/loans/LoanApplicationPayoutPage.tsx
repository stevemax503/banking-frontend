import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, Landmark, Loader2 } from 'lucide-react'
import { loansApi } from '@/api/loans'
import { accountsApi } from '@/api/accounts'
import { StyledSelect } from '@/components/forms/StyledSelect'
import ComplianceFeesModal from '@/components/transactions/ComplianceFeesModal'
import Spinner from '@/components/ui/Spinner'
import { formatAccountTypeLabel } from '@/lib/accountDisplay'
import { formatDisplayCurrency } from '@/utils/format'
import { accountIdentifierLastFour, formatAccountIdentifierDisplay } from '@/lib/uaeAccount'
import { guardUnlockedAccount } from '@/lib/accountLock'

type PayoutContext = {
  requires_compliance: boolean
  compliance_fee_total: string
  fee_lines: { code: string; name: string; amount: string; customer_message?: string }[]
  payout_message?: string
  resume: {
    session_id: string
    session_status: string
    from_account_id: string | null
    lines_total: number
    lines_verified: number
    expires_at: string
    can_resume: boolean
  } | null
}

export default function LoanApplicationPayoutPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [disburseAccountId, setDisburseAccountId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [complianceModalOpen, setComplianceModalOpen] = useState(false)

  const { data: appRes, isLoading: appLoading } = useQuery({
    queryKey: ['loan-application', applicationId],
    queryFn: () => loansApi.applicationDetail(applicationId!),
    enabled: !!applicationId,
  })
  const app = appRes?.data as
    | {
        id: string
        status: string
        requested_amount: string
        product_name: string
        payout_context?: PayoutContext
      }
    | undefined
  const payout = app?.payout_context

  const { data: accountsRes } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const accounts = (accountsRes?.data?.results || accountsRes?.data || []) as {
    id: string
    account_number: string
    iban?: string | null
    account_type: string
    balance?: string
  }[]

  useEffect(() => {
    if (!payout?.resume?.can_resume) return
    setSessionId(payout.resume.session_id)
    if (payout.resume.from_account_id) {
      setDisburseAccountId(payout.resume.from_account_id)
    }
  }, [payout?.resume?.session_id, payout?.resume?.can_resume, payout?.resume?.from_account_id])

  const startMutation = useMutation({
    mutationFn: (accountId: string) =>
      loansApi.regulatedPayoutStart(applicationId!, { disbursement_account_id: accountId }),
    onSuccess: (res) => {
      setSessionId(res.data.session_id)
      void queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] })
    },
  })

  const effectiveSessionId = sessionId ?? payout?.resume?.session_id ?? null

  const needsCompliance = Boolean(
    payout?.requires_compliance || (payout?.fee_lines?.length ?? 0) > 0,
  )

  const allFeesVerified =
    needsCompliance &&
    payout?.resume != null &&
    payout.resume.lines_total > 0 &&
    payout.resume.lines_verified === payout.resume.lines_total

  const completeMutation = useMutation({
    mutationFn: (regulatedSessionId?: string) =>
      loansApi.regulatedPayoutComplete(applicationId!, {
        regulated_session_id: regulatedSessionId,
        disbursement_account_id: disburseAccountId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] })
      queryClient.invalidateQueries({ queryKey: ['loan-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Your loan has been deposited.')
      navigate('/loans')
    },
    onError: async (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (
        typeof d === 'string' &&
        d.includes('regulated_session_id') &&
        disburseAccountId
      ) {
        try {
          const res = await startMutation.mutateAsync(disburseAccountId)
          setSessionId(res.data.session_id as string)
          setComplianceModalOpen(true)
          return
        } catch {
          /* fall through */
        }
      }
      toast.error(typeof d === 'string' ? d : 'Could not release funds.')
    },
  })

  const openComplianceFlow = async () => {
    let sid = effectiveSessionId
    if (!sid) {
      const res = await startMutation.mutateAsync(disburseAccountId)
      sid = res.data.session_id as string
      setSessionId(sid)
    }
    setComplianceModalOpen(true)
  }

  const handleReleaseFunds = async () => {
    if (!guardUnlockedAccount()) return
    if (!disburseAccountId) {
      toast.error('Select a receiving account first.')
      return
    }

    if (!needsCompliance) {
      completeMutation.mutate(undefined)
      return
    }

    if (allFeesVerified && effectiveSessionId) {
      completeMutation.mutate(effectiveSessionId)
      return
    }

    try {
      await openComplianceFlow()
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Could not start compliance verification.')
    }
  }

  const handleComplianceCompleted = () => {
    setComplianceModalOpen(false)
    void queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] })
    navigate('/loans')
  }

  if (appLoading || !applicationId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!app) {
    return <p className="py-20 text-center text-gray-500">Application not found.</p>
  }

  if (app.status !== 'APPROVED') {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-gray-700">This application is not ready for funding ({app.status}).</p>
        <button type="button" className="btn-outline text-sm" onClick={() => navigate('/loans')}>
          Back to loans
        </button>
      </div>
    )
  }

  const selectedAccount = accounts.find((a) => a.id === disburseAccountId)
  const releasing = completeMutation.isPending || startMutation.isPending

  return (
    <div className="mx-auto max-w-xl space-y-8 pb-16">
      <button
        type="button"
        onClick={() => navigate('/loans')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        <ArrowLeft size={16} aria-hidden />
        Loans
      </button>

      <div className="animate-pay-fade-up overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-md ring-1 ring-black/[0.03]">
        <div className="bg-gradient-to-br from-primary-dark via-primary-dark/95 to-primary-dark/85 px-6 py-8 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Landmark size={24} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Approved loan</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{app.product_name}</h1>
              <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">
                {formatDisplayCurrency(app.requested_amount)}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <p className="text-sm leading-relaxed text-gray-600">
            {needsCompliance
              ? (payout?.payout_message?.trim() ||
                  'Verification is required before we can release your funds.')
              : 'Choose the account where you would like to receive your funds.'}
          </p>
        </div>
      </div>

      <section className="animate-pay-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs leading-relaxed text-gray-500">
            Your approved loan amount will be credited here once verification is complete.
          </p>
          <StyledSelect
            id="disburse-account"
            label="Receiving account"
            value={disburseAccountId}
            onChange={(e) => setDisburseAccountId(e.target.value)}
          >
            <option value="">Choose an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAccountTypeLabel(a.account_type)} · ••••{accountIdentifierLastFour(a)}
                {a.balance != null ? ` · ${formatDisplayCurrency(a.balance)}` : ''}
              </option>
            ))}
          </StyledSelect>
          {selectedAccount ? (
            <div className="mt-3 rounded-xl border border-primary-dark/10 bg-primary-dark/[0.04] px-3.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">IBAN</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-gray-800">
                {formatAccountIdentifierDisplay(selectedAccount)}
              </p>
              {selectedAccount.balance != null ? (
                <p className="mt-1 text-xs text-gray-600">
                  Available balance{' '}
                  <span className="font-semibold tabular-nums text-gray-900">
                    {formatDisplayCurrency(selectedAccount.balance)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {allFeesVerified && needsCompliance ? (
        <div className="animate-pay-fade-up flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <span className="font-medium">Verification complete. You can release your funds below.</span>
        </div>
      ) : null}

      <section className="animate-pay-fade-up" style={{ animationDelay: '120ms' }}>
        <button
          type="button"
          className="btn-primary w-full py-3.5 text-sm font-semibold shadow-md shadow-primary-dark/15"
          disabled={!disburseAccountId || releasing}
          onClick={() => void handleReleaseFunds()}
        >
          {releasing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {startMutation.isPending ? 'Preparing…' : 'Releasing funds…'}
            </span>
          ) : (
            'Release funds to my account'
          )}
        </button>
      </section>

      <ComplianceFeesModal
        open={complianceModalOpen}
        sessionId={sessionId}
        flow="loan"
        loanApplicationId={applicationId}
        disbursementAccountId={disburseAccountId || undefined}
        onClose={() => {
          setComplianceModalOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] })
        }}
        onCompleted={handleComplianceCompleted}
      />
    </div>
  )
}
