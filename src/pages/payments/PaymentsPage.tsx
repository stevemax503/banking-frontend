import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import {
  Building2,
  Bus,
  Globe,
  GraduationCap,
  Landmark,
  Receipt,
  Shield,
  Smartphone,
  Zap,
} from 'lucide-react'
import { accountsApi } from '@/api/accounts'
import { paymentsApi } from '@/api/payments'
import { Input } from '@/components/forms/Input'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { accountIdentifierLastFour } from '@/lib/uaeAccount'
import { cn } from '@/utils/cn'
import { BILL_SERVICES, DEFAULT_SERVICE_ID, getBiller, getService } from '@/lib/uaeBillPayCatalog'
import { fetchUsdToAed, formatAedEquivalent } from '@/lib/fxUsdAed'
import { buildPaymentDescription } from '@/lib/paymentDescription'

const SERVICE_ICONS: Record<string, typeof Zap> = {
  utilities: Zap,
  telecom: Smartphone,
  transport: Bus,
  insurance: Shield,
  taxes_gov: Landmark,
  housing: Building2,
  education: GraduationCap,
  international: Globe,
  other: Receipt,
}

const serviceIds = BILL_SERVICES.map((s) => s.id) as [string, ...string[]]

const formSchema = z
  .object({
    account_id: z.string().min(1, 'Choose an account'),
    service_id: z.enum(serviceIds),
    biller_id: z.string().min(1, 'Select a biller'),
    product_id: z.string().optional(),
    reference: z
      .string()
      .min(1, 'Enter the reference from your bill or policy')
      .max(96, 'Reference is too long — use the number shown on your bill'),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount')
      .refine((v) => parseFloat(v) > 0, 'Amount must be greater than zero'),
    order_id: z.string().optional(),
    narration: z
      .string()
      .min(3, 'Add a short narration for your statement (at least 3 characters)')
      .max(200, 'Narration is too long — shorten to 200 characters or less'),
  })
  .superRefine((data, ctx) => {
    const biller = getBiller(data.service_id, data.biller_id)
    if (biller?.requiresProduct && !(data.product_id && data.product_id.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a product or payment type',
        path: ['product_id'],
      })
    }
  })

type FormData = z.infer<typeof formSchema>

function formatPaymentApiError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return 'Payment could not be completed.'
  const detail = data.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(String).join(' ')
  const parts: string[] = []
  for (const [key, val] of Object.entries(data)) {
    if (key === 'detail') continue
    if (Array.isArray(val)) {
      val.forEach((v) => parts.push(typeof v === 'string' ? `${key}: ${v}` : `${key}: ${String(v)}`))
    } else if (typeof val === 'string') {
      parts.push(`${key}: ${val}`)
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'Payment could not be completed.'
}

export default function PaymentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: accountsRes, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const raw = accountsRes?.data
  const accounts = Array.isArray(raw) ? raw : Array.isArray((raw as { results?: unknown })?.results) ? (raw as { results: unknown[] }).results : []

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      service_id: DEFAULT_SERVICE_ID,
      biller_id: '',
      product_id: '',
      reference: '',
      amount: '',
      order_id: '',
      narration: '',
    },
  })

  const serviceId = watch('service_id')
  const billerId = watch('biller_id')
  const amountUsdStr = watch('amount')
  const payFromAccountId = watch('account_id')
  const fxQueryEnabled = Boolean(payFromAccountId?.trim())

  const rateQuery = useQuery({
    queryKey: ['fx', 'usd-aed'],
    queryFn: fetchUsdToAed,
    staleTime: 60 * 60 * 1000,
    retry: 2,
    enabled: fxQueryEnabled,
  })

  const feeQuery = useQuery({
    queryKey: ['payment-mgmt-fee', serviceId, billerId],
    queryFn: () =>
      paymentsApi.resolveManagementFee(serviceId, billerId).then((r) => r.data),
    enabled: Boolean(serviceId && billerId),
    staleTime: 60 * 1000,
  })

  const usdNum = parseFloat(amountUsdStr || '')
  const rate = rateQuery.data?.rate
  const aedDisplay =
    rate != null && !Number.isNaN(usdNum) && usdNum > 0 ? formatAedEquivalent(usdNum, rate) : null

  const managementFee = feeQuery.data?.management_fee ? parseFloat(feeQuery.data.management_fee) : null
  const billUsd = !Number.isNaN(usdNum) && usdNum > 0 ? usdNum : 0
  const mgmtUsd = managementFee != null && !Number.isNaN(managementFee) ? managementFee : 0
  const subtotalBillAndMgmt = billUsd + mgmtUsd

  useEffect(() => {
    setValue('biller_id', '')
    setValue('product_id', '')
    setValue('reference', '')
    setValue('order_id', '')
  }, [serviceId, setValue])

  useEffect(() => {
    setValue('product_id', '')
  }, [billerId, setValue])

  const service = getService(serviceId)
  const biller = billerId ? getBiller(serviceId, billerId) : undefined

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const biller = getBiller(data.service_id, data.biller_id)
      const productLabel = biller?.products?.find((p) => p.id === data.product_id)?.label
      const usd = parseFloat(data.amount)
      const liveRate = rateQuery.data?.rate
      const aedApprox = liveRate != null && !Number.isNaN(usd) && usd > 0 ? usd * liveRate : undefined
      const amountUsdLabel = `USD ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const aedApproxLabel =
        aedApprox != null && Number.isFinite(aedApprox)
          ? `≈ AED ${aedApprox.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : undefined
      return paymentsApi.billPay({
        account_id: data.account_id,
        amount: data.amount,
        service_id: data.service_id,
        biller_id: data.biller_id,
        description: buildPaymentDescription({
          billerName: biller?.name ?? data.biller_id,
          productLabel,
          reference: data.reference,
          orderId: data.order_id,
          amountUsdLabel,
          aedApproxLabel,
          narration: data.narration,
        }),
        idempotency_key: uuidv4(),
      })
    },
    onSuccess: () => {
      toast.success('Payment submitted.')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      navigate('/transactions')
    },
    onError: (err: unknown) => {
      toast.error(formatPaymentApiError(err))
    },
  })

  const aedHint =
    !fxQueryEnabled ? null : rateQuery.isLoading ? '…' : rateQuery.isError ? null : aedDisplay != null ? `≈ AED ${aedDisplay}` : null

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
        <div className="bg-primary-dark px-4 py-3 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Bill payments</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent/90">USD · AED reference</p>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Open an account to pay bills.</p>
          ) : (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
              <StyledSelect label="Pay from" error={errors.account_id?.message} {...register('account_id')}>
                <option value="">Select account</option>
                {accounts.map((a: { id: string; account_number: string; iban?: string | null; account_type: string; balance: string }) => (
                  <option key={a.id} value={a.id}>
                    {a.account_type} · ····{accountIdentifierLastFour(a)} · {formatDisplayCurrency(a.balance)}
                  </option>
                ))}
              </StyledSelect>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BILL_SERVICES.map((svc) => {
                    const Icon = SERVICE_ICONS[svc.id] ?? Receipt
                    const active = serviceId === svc.id
                    return (
                      <label
                        key={svc.id}
                        className={cn(
                          'flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-3 transition-colors',
                          active
                            ? 'border-primary-dark bg-primary-dark/[0.06]'
                            : 'border-gray-100 bg-gray-50/80 hover:border-gray-200 hover:bg-white',
                        )}
                      >
                        <input type="radio" value={svc.id} className="sr-only" {...register('service_id')} />
                        <Icon size={20} className={active ? 'text-primary-dark' : 'text-gray-500'} aria-hidden />
                        <span className={cn('text-xs font-semibold leading-tight', active ? 'text-gray-900' : 'text-gray-600')}>
                          {svc.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {errors.service_id && <p className="mt-2 text-xs text-red-600">{errors.service_id.message}</p>}
              </div>

              {service && (
                <div key={serviceId} className="space-y-5 border-t border-gray-100 pt-5">
                  <StyledSelect label="Biller" error={errors.biller_id?.message} {...register('biller_id')}>
                    <option value="">Select biller</option>
                    {service.billers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </StyledSelect>

                  {biller?.requiresProduct && biller.products && biller.products.length > 0 && (
                    <StyledSelect label="Product" error={errors.product_id?.message} {...register('product_id')}>
                      <option value="">Select product</option>
                      {biller.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </StyledSelect>
                  )}

                  {biller && (
                    <Input
                      label={biller.referenceLabel}
                      placeholder={biller.referenceHint || 'Reference from your bill'}
                      error={errors.reference?.message}
                      {...register('reference')}
                    />
                  )}

                  {biller?.orderIdApplicable && (
                    <Input
                      label="Order ID (optional)"
                      placeholder="If provided by biller"
                      error={errors.order_id?.message}
                      {...register('order_id')}
                    />
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Amount (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        autoComplete="off"
                        className={cn(
                          'input-field text-sm tabular-nums',
                          errors.amount && 'border-red-300 focus:border-red-400 focus:ring-red-100',
                        )}
                        {...register('amount')}
                      />
                      {errors.amount && <p className="text-xs text-red-600">{errors.amount.message}</p>}
                    </div>
                    {aedHint ? (
                      <div className="flex flex-col justify-end rounded-xl border border-gray-100 bg-gray-50/90 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">AED (indicative)</p>
                        <p className="mt-1 text-lg font-bold tabular-nums text-primary-dark">{aedHint}</p>
                      </div>
                    ) : null}
                  </div>

                  {biller && managementFee != null && !feeQuery.isLoading && !feeQuery.isError ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/90 px-4 py-3 text-sm">
                      <span className="text-gray-600">
                        Bill {formatDisplayCurrency(billUsd || 0)} + fee {formatDisplayCurrency(mgmtUsd)}
                      </span>
                      <span className="font-bold tabular-nums text-primary-dark">
                        {formatDisplayCurrency(subtotalBillAndMgmt)}
                      </span>
                    </div>
                  ) : biller && feeQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Spinner size="sm" />
                      Loading fee…
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Narration</label>
                    <textarea
                      rows={2}
                      placeholder="Statement description"
                      className={cn(
                        'input-field min-h-[72px] resize-y text-sm',
                        errors.narration && 'border-red-300 focus:border-red-400 focus:ring-red-100',
                      )}
                      {...register('narration')}
                    />
                    {errors.narration && <p className="text-xs text-red-600">{errors.narration.message}</p>}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending || !biller || feeQuery.isLoading}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
              >
                {mutation.isPending && <Spinner size="sm" className="border-white border-t-white/30" />}
                Pay bill
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
