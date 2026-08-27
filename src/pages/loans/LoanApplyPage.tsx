import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { AxiosError } from 'axios'
import toast from 'react-hot-toast'
import { FileText, Landmark } from 'lucide-react'
import { loansApi } from '@/api/loans'
import { guardUnlockedAccount } from '@/lib/accountLock'
import { Input } from '@/components/forms/Input'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import {
  LOAN_CATALOG_LIMITS,
  LOAN_TYPE_DISPLAY_NAMES,
  LOAN_TYPE_ORDER,
  resolveLoanProductDisplay,
  type LoanCatalogType,
} from '@/lib/loanProductVisuals'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isLoanCatalogType(s: string): s is LoanCatalogType {
  return (LOAN_TYPE_ORDER as readonly string[]).includes(s)
}

function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)) {
    return (payload as { results: unknown[] }).results
  }
  return []
}

type ApiLoanProduct = {
  id: string
  name: string
  loan_type: string
  min_amount: string
  max_amount: string
  min_term_months: number
  max_term_months: number
  tagline?: string
  description?: string
}

type ApplyLimits = {
  min_amount: string
  max_amount: string
  min_term_months: number
  max_term_months: number
}

function limitsToNums(l: ApplyLimits) {
  return {
    minA: parseFloat(l.min_amount),
    maxA: parseFloat(l.max_amount),
    minT: l.min_term_months,
    maxT: l.max_term_months,
  }
}

function makeApplySchema(limits: ApplyLimits) {
  const { minA, maxA, minT, maxT } = limitsToNums(limits)
  return z
    .object({
      requested_amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (up to 2 decimal places)'),
      term_months: z.coerce.number().int('Enter a whole number of months'),
      purpose: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const amt = parseFloat(data.requested_amount)
      if (Number.isNaN(amt)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['requested_amount'], message: 'Enter a valid amount' })
        return
      }
      if (amt < minA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requested_amount'],
          message: `Amount must be at least ${formatDisplayCurrency(String(minA))}`,
        })
      }
      if (amt > maxA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['requested_amount'],
          message: `Amount must not exceed ${formatDisplayCurrency(String(maxA))}`,
        })
      }
      if (data.term_months < minT || data.term_months > maxT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['term_months'],
          message: `Term must be between ${minT} and ${maxT} months`,
        })
      }
    })
}

function formatApplyError(err: unknown): string {
  const ax = err as AxiosError<{ detail?: unknown; [key: string]: unknown }>
  const data = ax.response?.data
  if (!data || typeof data !== 'object') return 'Application failed.'
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) {
    return data.detail.map((d: unknown) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')
  }
  const parts: string[] = []
  for (const [key, val] of Object.entries(data)) {
    if (key === 'detail') continue
    if (typeof val === 'string') parts.push(val)
    else if (Array.isArray(val)) parts.push(val.map(String).join(' '))
  }
  return parts.length ? parts.join(' ') : 'Application failed.'
}

type Resolution =
  | { state: 'invalid' }
  | { state: 'pending_product'; productId: string }
  | { state: 'unknown_product'; productId: string }
  | {
      state: 'ready'
      displayName: string
      loanType: string
      tagline: string
      heroImage: string
      limits: ApplyLimits
      submitProductId: string | null
      submitLoanType: LoanCatalogType | null
    }

function ApplyMessageCard({
  title,
  message,
  onBack,
}: {
  title: string
  message: string
  onBack: () => void
}) {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="bg-primary-dark px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600">{message}</p>
          <button type="button" onClick={onBack} className="btn-outline text-sm">
            Back to loans
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoanApplyPage() {
  const { applyToken = '' } = useParams<{ applyToken: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: productsRes, isLoading: productsLoading, isFetched: productsFetched } = useQuery({
    queryKey: ['loan-products'],
    queryFn: loansApi.products,
  })
  const products = normalizeList(productsRes?.data) as ApiLoanProduct[]

  const resolution = useMemo((): Resolution => {
    const token = applyToken.trim()
    if (!token) return { state: 'invalid' }

    const buildReady = (apiProduct: ApiLoanProduct | null, loanType: string, catalogFallback?: LoanCatalogType) => {
      const limits: ApplyLimits = apiProduct
        ? {
            min_amount: apiProduct.min_amount,
            max_amount: apiProduct.max_amount,
            min_term_months: apiProduct.min_term_months,
            max_term_months: apiProduct.max_term_months,
          }
        : LOAN_CATALOG_LIMITS[catalogFallback ?? 'PERSONAL']
      const display = resolveLoanProductDisplay(
        apiProduct ?? { loan_type: loanType, description: undefined, tagline: undefined },
      )
      return {
        state: 'ready' as const,
        displayName: apiProduct?.name ?? LOAN_TYPE_DISPLAY_NAMES[loanType as LoanCatalogType] ?? 'Loan',
        loanType,
        tagline: display.tagline,
        heroImage: display.heroImage,
        limits,
        submitProductId: apiProduct?.id ?? null,
        submitLoanType: apiProduct ? null : (catalogFallback ?? null),
      }
    }

    if (isLoanCatalogType(token)) {
      const apiProduct = products.find((p) => p.loan_type === token) ?? null
      return buildReady(apiProduct, token, token)
    }

    if (UUID_RE.test(token)) {
      const apiProduct = products.find((p) => p.id === token) ?? null
      if (apiProduct) {
        return buildReady(apiProduct, apiProduct.loan_type)
      }
      return { state: 'pending_product', productId: token }
    }

    return { state: 'invalid' }
  }, [applyToken, products])

  const effectiveResolution = useMemo((): Resolution => {
    if (resolution.state !== 'pending_product') return resolution
    if (productsLoading || !productsFetched) return resolution
    return { state: 'unknown_product', productId: resolution.productId }
  }, [resolution, productsLoading, productsFetched])

  const ready = effectiveResolution.state === 'ready' ? effectiveResolution : null
  const limits = ready?.limits

  const schema = useMemo(() => (limits ? makeApplySchema(limits) : makeApplySchema(LOAN_CATALOG_LIMITS.PERSONAL)), [limits])

  const defaultValues = useMemo(
    () => ({
      requested_amount: limits?.min_amount ?? LOAN_CATALOG_LIMITS.PERSONAL.min_amount,
      term_months: limits?.min_term_months ?? LOAN_CATALOG_LIMITS.PERSONAL.min_term_months,
      purpose: '',
    }),
    [limits],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    if (limits) {
      reset({
        requested_amount: limits.min_amount,
        term_months: limits.min_term_months,
        purpose: '',
      })
    }
  }, [limits, reset])

  const mutation = useMutation({
    mutationFn: (data: { requested_amount: string; term_months: number; purpose?: string }) => {
      if (!ready) throw new Error('Not ready')
      if (ready.submitProductId) {
        return loansApi.applyForLoan({
          product: ready.submitProductId,
          requested_amount: data.requested_amount,
          term_months: data.term_months,
          purpose: data.purpose,
        })
      }
      if (ready.submitLoanType) {
        return loansApi.applyForLoan({
          loan_type: ready.submitLoanType,
          requested_amount: data.requested_amount,
          term_months: data.term_months,
          purpose: data.purpose,
        })
      }
      throw new Error('Nothing to submit')
    },
    onSuccess: () => {
      toast.success('Loan application submitted.')
      queryClient.invalidateQueries({ queryKey: ['loan-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] })
      navigate('/loans')
    },
    onError: (err: unknown) => {
      toast.error(formatApplyError(err))
    },
  })

  if (effectiveResolution.state === 'invalid') {
    return (
      <ApplyMessageCard
        title="Invalid link"
        message="This loan link is not valid. Choose a product from the loans page and try again."
        onBack={() => navigate('/loans')}
      />
    )
  }

  if (effectiveResolution.state === 'pending_product') {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (effectiveResolution.state === 'unknown_product') {
    return (
      <ApplyMessageCard
        title="Product unavailable"
        message="This loan product is no longer offered. Return to loans and select an active product."
        onBack={() => navigate('/loans')}
      />
    )
  }

  if (!ready || !limits) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const { minA, maxA, minT, maxT } = limitsToNums(limits)
  const loanTypeLabel = ready.loanType.replace(/_/g, ' ')

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="relative overflow-hidden bg-primary-dark">
          <img
            src={ready.heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-dark via-primary-dark/92 to-primary-dark/75" />
          <div className="relative px-4 py-5 sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">{loanTypeLabel}</p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">Apply for {ready.displayName}</h1>
            <p className="mt-1 max-w-lg text-sm leading-snug text-white/80">{ready.tagline}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/70 text-center">
          <div className="px-2 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Amount</p>
            <p className="mt-0.5 text-xs font-bold leading-snug text-gray-900 sm:text-sm">
              {formatDisplayCurrency(limits.min_amount)}
              <span className="font-normal text-gray-400"> – </span>
              {formatDisplayCurrency(limits.max_amount)}
            </p>
          </div>
          <div className="px-2 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Term</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900">
              {limits.min_term_months}–{limits.max_term_months} mo
            </p>
          </div>
          <div className="px-2 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Review</p>
            <p className="mt-0.5 text-xs font-medium text-gray-700">Credit check</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => {
          if (!guardUnlockedAccount()) return
          mutation.mutate(d)
        })} className="space-y-5 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Loan amount"
              placeholder={formatDisplayCurrency(limits.min_amount)}
              type="number"
              step="0.01"
              min={minA}
              max={maxA}
              error={errors.requested_amount?.message}
              {...register('requested_amount')}
            />
            <Input
              label="Term (months)"
              placeholder={`${minT} – ${maxT}`}
              type="number"
              step="1"
              min={minT}
              max={maxT}
              error={errors.term_months?.message}
              {...register('term_months', { valueAsNumber: true })}
            />
          </div>

          <div>
            <label
              htmlFor="loan-purpose"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              <FileText size={14} className="text-primary-dark" aria-hidden />
              Purpose <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              id="loan-purpose"
              className="input-field min-h-[88px] w-full resize-y text-sm"
              placeholder="e.g. Vehicle purchase, home improvement, working capital…"
              {...register('purpose')}
            />
          </div>

          <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
            <Landmark size={18} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden />
            <p className="text-xs leading-relaxed text-gray-600">
              Submitting starts a formal review. You will see rates and repayment terms before accepting any offer.
              Supporting documents may be requested by email.
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {mutation.isPending ? <Spinner size="sm" className="border-white border-t-white/30" /> : null}
            Submit application
          </button>
        </form>
      </div>
    </div>
  )
}
