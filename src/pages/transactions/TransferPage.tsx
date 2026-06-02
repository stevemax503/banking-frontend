import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Landmark,
  Lock,
  X,
} from 'lucide-react'
import { usePageChrome } from '@/contexts/PageChromeContext'
import { transactionsApi } from '@/api/transactions'
import { accountsApi } from '@/api/accounts'
import type { PreviewPayload } from './transferTypes'
import type { TransactionListItem } from '@/utils/transactionDisplay'
import ComplianceFeesModal from '@/components/transactions/ComplianceFeesModal'
import TransferSuccessReceipt from '@/components/transactions/TransferSuccessReceipt'
import { asTransactionListItem, buildTransferReceiptFromForm } from '@/lib/transactionApiMappers'
import {
  TRANSFER_UI_MOCK,
  MOCK_ACCOUNTS,
  MOCK_REG_SESSION_ID,
  MOCK_TRANSFER_OTP,
  MOCK_COMPLIANCE_OTP,
  buildMockTransferPreview,
  SAMPLE_INTERNATIONAL_WIRE,
  effectiveToAccountId,
} from './transferMock'
import {
  buildInternationalDetails,
  transferDescription,
  generateMockUetr,
  internationalFieldDefaults,
  internationalPreviewIncompleteMessage,
  internationalZodShape,
  type InternationalTransferFormValues,
  validateInternationalFields,
} from './internationalTransfer'
import InternationalTransferFormSections from './InternationalTransferFormSections'
import { Input } from '@/components/forms/Input'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import {
  cardBrandBadgeClass,
  cardBrandLabel,
  detectCardBrand,
  digitsOnly,
  luhnValid,
} from '@/lib/cardBrand'
import {
  DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH,
  DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH,
  formatDomesticAccountNumber,
  formatUaeIban,
  isValidUaeIban,
} from '@/lib/uaeAccount'
import {
  amountExceedsBalance,
  isValidDestinationAccountNumber,
  normalizeDestinationAccountNumber,
  parseMoneyAmount,
} from './transferValidation'

const transferSchema = z
  .object({
    account_id: z.string().min(1, 'Select an account'),
    to_account_id: z.string(),
    account_holder_name: z.string(),
    external_bank_name: z.string(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount'),
    description: z.string().optional(),
    transfer_type: z.string(),
    ...internationalZodShape,
  })
  .superRefine((data, ctx) => {
    if (data.transfer_type !== 'TRANSFER_INTERNATIONAL') {
      if (!data.to_account_id?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['to_account_id'],
          message: 'Enter the recipient account number.',
        })
      } else if (!isValidDestinationAccountNumber(data.to_account_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['to_account_id'],
          message: `Account number must be ${DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH} to ${DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH} digits.`,
        })
      }
      const holder = data.account_holder_name?.trim() ?? ''
      if (holder.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['account_holder_name'],
          message: 'Enter the account holder name (at least 2 characters).',
        })
      }
      if (data.transfer_type === 'TRANSFER_EXTERNAL') {
        const bank = data.external_bank_name?.trim() ?? ''
        if (bank.length < 2) {
          ctx.addIssue({
            code: 'custom',
            path: ['external_bank_name'],
            message: 'Enter the recipient bank name (at least 2 characters).',
          })
        }
      }
      return
    }
    if (!data.amount?.trim() || !/^\d+(\.\d{1,2})?$/.test(data.amount)) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid transfer amount.' })
    }
    validateInternationalFields(data, ctx)
  })
type TransferFormData = z.infer<typeof transferSchema>

const cardSchema = z
  .object({
    deposit_account_id: z.string().min(1, 'Select an account to credit'),
    cardholder: z.string().min(2, 'Enter name as shown on card'),
    pan: z.string().min(1, 'Enter card number'),
    expiry: z
      .string()
      .min(4)
      .refine((raw) => {
        const t = raw.replace(/\D/g, '')
        if (t.length !== 4) return false
        const mm = parseInt(t.slice(0, 2), 10)
        return mm >= 1 && mm <= 12
      }, 'Invalid expiry (MM/YY)'),
    cvv: z.string().regex(/^\d{3,4}$/, 'Invalid security code'),
  })
  .superRefine((data, ctx) => {
    const pan = digitsOnly(data.pan)
    if (pan.length < 13) {
      ctx.addIssue({ code: 'custom', path: ['pan'], message: 'Card number is too short' })
    } else if (!luhnValid(pan)) {
      ctx.addIssue({ code: 'custom', path: ['pan'], message: 'Card number does not pass validation' })
    }
  })
type CardFormData = z.infer<typeof cardSchema>

type FlowTab = 'transfer' | 'card'

function formatPanInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 19)
  const parts: string[] = []
  for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4))
  return parts.join(' ')
}

/** DRF often returns field errors (e.g. to_account_id) without a top-level detail string. */
function transferPreviewErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data || typeof data !== 'object') return ''

  const pick = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === 'string' && (x as string).trim())
      return typeof first === 'string' ? first.trim() : null
    }
    return null
  }

  for (const key of [
    'detail',
    'to_account_id',
    'amount',
    'from_account_id',
    'transfer_type',
    'charges_option',
    'remittance_reference',
    'beneficiary_bank_country',
    'beneficiary_postal_code',
    'non_field_errors',
  ]) {
    const msg = pick(data[key])
    if (msg) return msg
  }
  const intlErr = data.international_details
  if (intlErr && typeof intlErr === 'object' && !Array.isArray(intlErr)) {
    const messages = Object.values(intlErr as Record<string, unknown>)
      .map(pick)
      .filter((m): m is string => Boolean(m))
    if (messages.length > 0) {
      const looksIncomplete = messages.every(
        (m) =>
          m === 'Required.' ||
          m === 'This field is required.' ||
          /^Must be at least \d+ characters\.$/.test(m),
      )
      if (looksIncomplete || messages.length > 1) {
        return 'Complete all required international transfer fields above to see fees and confirm.'
      }
      return messages[0]
    }
  }
  for (const val of Object.values(data)) {
    const msg = pick(val)
    if (msg) return msg
  }
  return ''
}

export default function TransferPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<FlowTab>('transfer')
  const [step, setStep] = useState<1 | 3>(1)
  const [transferOtp, setTransferOtp] = useState('')
  const [regulatedSessionId, setRegulatedSessionId] = useState<string | null>(null)
  const [complianceModalOpen, setComplianceModalOpen] = useState(false)
  const [cardUnavailableModalOpen, setCardUnavailableModalOpen] = useState(false)
  const [completedUetr, setCompletedUetr] = useState<string | null>(null)
  const [completedTransaction, setCompletedTransaction] = useState<TransactionListItem | null>(null)
  const regulatedSessionIdempotencyRef = useRef<string | null>(null)
  const [transferOtpSent, setTransferOtpSent] = useState(false)
  const [otpValiditySecondsLeft, setOtpValiditySecondsLeft] = useState(0)

  /** Matches backend `OTP_EMAIL_TOKEN_VALIDITY` default (300s = 5 minutes). */
  const TRANSFER_OTP_VALIDITY_SEC = 300

  const resetTransferOtpFlow = useCallback(() => {
    setTransferOtpSent(false)
    setOtpValiditySecondsLeft(0)
    setTransferOtp('')
  }, [])

  const { data: accountsRes } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
    enabled: !TRANSFER_UI_MOCK,
  })
  const accountsFromApi = accountsRes?.data?.results || accountsRes?.data || []
  const accounts = TRANSFER_UI_MOCK ? [...MOCK_ACCOUNTS] : accountsFromApi

  const transferForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      transfer_type: 'TRANSFER_INTERNAL',
      account_id: '',
      to_account_id: '',
      account_holder_name: '',
      external_bank_name: '',
      amount: '',
      description: '',
      ...internationalFieldDefaults,
    },
  })
  const tWatch = transferForm.watch()

  const cardForm = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
  })
  const cWatch = cardForm.watch()
  const panDigits = digitsOnly(cWatch.pan || '')
  const cardBrand = detectCardBrand(panDigits)

  const accountById = (id: string) =>
    accounts.find((a: { id: string }) => a.id === id) as
      | { id: string; account_number: string; iban?: string | null; account_type: string; balance: string }
      | undefined

  const domesticTransferReady =
    isValidDestinationAccountNumber(tWatch.to_account_id || '') &&
    (tWatch.account_holder_name?.trim().length ?? 0) >= 2 &&
    (tWatch.transfer_type !== 'TRANSFER_EXTERNAL' || (tWatch.external_bank_name?.trim().length ?? 0) >= 2)

  const internationalPreviewHint =
    tWatch.transfer_type === 'TRANSFER_INTERNATIONAL'
      ? internationalPreviewIncompleteMessage(tWatch)
      : null
  const internationalPreviewReady = internationalPreviewHint === null

  const previewEnabled =
    tab === 'transfer' &&
    step === 1 &&
    !!tWatch.account_id &&
    !!tWatch.amount &&
    /^\d+(\.\d{1,2})?$/.test(tWatch.amount) &&
    (tWatch.transfer_type === 'TRANSFER_INTERNATIONAL' || domesticTransferReady)

  const {
    data: previewRes,
    error: previewQueryError,
    isLoading: previewQueryLoading,
    isError: previewQueryIsError,
  } = useQuery({
    queryKey: [
      'transfer-preview',
      tWatch.account_id,
      tWatch.to_account_id,
      tWatch.account_holder_name,
      tWatch.external_bank_name,
      tWatch.amount,
      tWatch.transfer_type,
      tWatch.beneficiary_legal_name,
      tWatch.beneficiary_address_line1,
      tWatch.beneficiary_address_line2,
      tWatch.beneficiary_city,
      tWatch.beneficiary_region_state,
      tWatch.beneficiary_postal_code,
      tWatch.beneficiary_country,
      tWatch.beneficiary_bank_name,
      tWatch.beneficiary_bank_address_line1,
      tWatch.beneficiary_bank_address_line2,
      tWatch.beneficiary_bank_city,
      tWatch.beneficiary_bank_country,
      tWatch.beneficiary_bic_swift,
      tWatch.beneficiary_iban,
      tWatch.purpose_of_payment,
      tWatch.remittance_reference,
      tWatch.charges_option,
      tWatch.intermediary_bank_bic,
      tWatch.intermediary_bank_name,
      tWatch.instructions_to_beneficiary_bank,
    ],
    queryFn: () => {
      const base = {
        from_account_id: tWatch.account_id!,
        to_account_id: effectiveToAccountId(tWatch.transfer_type, tWatch.to_account_id),
        amount: tWatch.amount,
        transfer_type: tWatch.transfer_type,
      }
      if (tWatch.transfer_type === 'TRANSFER_INTERNATIONAL') {
        return transactionsApi.transferPreview({
          ...base,
          international_details: buildInternationalDetails(transferForm.getValues()),
        })
      }
      return transactionsApi.transferPreview(base)
    },
    enabled: previewEnabled && internationalPreviewReady && !TRANSFER_UI_MOCK,
    retry: false,
  })

  const mockPreviewData = useMemo((): PreviewPayload | undefined => {
    if (!TRANSFER_UI_MOCK || !previewEnabled) return undefined
    return buildMockTransferPreview({
      amount: tWatch.amount,
      transfer_type: tWatch.transfer_type,
      to_account_id: effectiveToAccountId(tWatch.transfer_type, tWatch.to_account_id),
      transfer_currency: tWatch.transfer_currency as 'USD' | 'EUR' | 'GBP',
      delivery_method: tWatch.delivery_method,
    })
  }, [
    tWatch.amount,
    tWatch.transfer_type,
    tWatch.to_account_id,
    tWatch.account_id,
    tWatch.beneficiary_legal_name,
    tWatch.beneficiary_address_line1,
    tWatch.beneficiary_address_line2,
    tWatch.beneficiary_city,
    tWatch.beneficiary_region_state,
    tWatch.beneficiary_postal_code,
    tWatch.beneficiary_country,
    tWatch.beneficiary_bank_name,
    tWatch.beneficiary_bank_address_line1,
    tWatch.beneficiary_bank_address_line2,
    tWatch.beneficiary_bank_city,
    tWatch.beneficiary_bank_country,
    tWatch.beneficiary_bic_swift,
    tWatch.beneficiary_iban,
    tWatch.purpose_of_payment,
    tWatch.remittance_reference,
    tWatch.charges_option,
    tWatch.intermediary_bank_bic,
    tWatch.intermediary_bank_name,
    tWatch.instructions_to_beneficiary_bank,
    tWatch.delivery_method,
    tWatch.transfer_currency,
    tWatch.account_number_type,
    previewEnabled,
  ])

  const preview = TRANSFER_UI_MOCK ? mockPreviewData : (previewRes?.data as PreviewPayload | undefined)
  const previewLoading = TRANSFER_UI_MOCK ? false : previewQueryLoading
  const previewError = TRANSFER_UI_MOCK ? false : previewQueryIsError

  const finishTransferSuccess = useCallback(
    (apiTx?: TransactionListItem | null) => {
      if (!TRANSFER_UI_MOCK) {
        void queryClient.invalidateQueries({ queryKey: ['accounts'] })
        void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }
      setComplianceModalOpen(false)
      setRegulatedSessionId(null)

      const vals = transferForm.getValues()
      const fromAcc = accounts.find((a: { id: string }) => a.id === vals.account_id)
      setCompletedTransaction(buildTransferReceiptFromForm(vals, fromAcc, apiTx ?? undefined))

      if (vals.transfer_type === 'TRANSFER_INTERNATIONAL') {
        setCompletedUetr(generateMockUetr())
      }
      setStep(3)
    },
    [queryClient, transferForm, accounts],
  )

  useEffect(() => {
    const resumeId = searchParams.get('resume_session')
    if (!resumeId) return
    setTab('transfer')
    setRegulatedSessionId(resumeId)
    setComplianceModalOpen(true)
    setSearchParams({}, { replace: true })
    toast.success('Resume compliance verification for your pending transfer.')
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const st = location.state as { completedTransaction?: TransactionListItem } | null
    if (!st?.completedTransaction) return
    setTab('transfer')
    setCompletedTransaction(st.completedTransaction)
    setStep(3)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const intlSessionMutation = useMutation({
    mutationFn: async (transferOtpForSession: string) => {
      if (TRANSFER_UI_MOCK) {
        if (transferOtpForSession !== MOCK_TRANSFER_OTP) {
          throw Object.assign(new Error('demo otp'), {
            response: { data: { detail: `Demo mode: enter transfer code ${MOCK_TRANSFER_OTP}` } },
          })
        }
        await new Promise((r) => setTimeout(r, 450))
        return { data: { session_id: MOCK_REG_SESSION_ID } }
      }
      const v = transferForm.getValues()
      return transactionsApi.regulatedIntlSessionStart({
        from_account_id: v.account_id,
        to_account_id: effectiveToAccountId(v.transfer_type, v.to_account_id),
        amount: v.amount,
        transfer_type: v.transfer_type,
        description: transferDescription(v),
        transfer_otp: transferOtpForSession,
        international_details: buildInternationalDetails(v),
        ...(regulatedSessionIdempotencyRef.current
          ? { idempotency_key: regulatedSessionIdempotencyRef.current }
          : {}),
      })
    },
    onSuccess: (res) => {
      const sid = TRANSFER_UI_MOCK ? MOCK_REG_SESSION_ID : res.data.session_id
      setRegulatedSessionId(sid)
      setComplianceModalOpen(true)
      if (!TRANSFER_UI_MOCK) {
        void queryClient.invalidateQueries({ queryKey: ['accounts'] })
        void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }
      toast.success(
        'Transfer is pending. Complete compliance fees to finish — you can also resume from Transactions.',
      )
    },
    onError: (err: unknown) => {
      setComplianceModalOpen(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Could not start compliance session.')
    },
  })

  const transferMutation = useMutation({
    mutationFn: async (data: TransferFormData & { otp?: string; regulated_session_id?: string }) => {
      if (TRANSFER_UI_MOCK) {
        if (data.transfer_type === 'TRANSFER_EXTERNAL' && data.otp && data.otp !== MOCK_TRANSFER_OTP) {
          throw Object.assign(new Error('demo otp'), {
            response: { data: { detail: `Demo mode: use ${MOCK_TRANSFER_OTP}` } },
          })
        }
        await new Promise((r) => setTimeout(r, 650))
        return { data: { reference_number: 'TXNMOCK0001', id: '00000000-0000-4000-8000-000000000099' } }
      }
      const key = uuidv4()
      return transactionsApi.transfer({
        from_account_id: data.account_id,
        to_account_id: effectiveToAccountId(data.transfer_type, data.to_account_id),
        amount: data.amount,
        description: transferDescription(data),
        transfer_type: data.transfer_type,
        idempotency_key: key,
        ...(data.otp ? { otp: data.otp } : {}),
        ...(data.regulated_session_id ? { regulated_session_id: data.regulated_session_id } : {}),
        ...(data.transfer_type === 'TRANSFER_INTERNATIONAL'
          ? { international_details: buildInternationalDetails(data) }
          : {
              account_holder_name: data.account_holder_name.trim(),
              ...(data.transfer_type === 'TRANSFER_EXTERNAL'
                ? { external_bank_name: data.external_bank_name.trim() }
                : {}),
            }),
      })
    },
    onSuccess: (res) => {
      finishTransferSuccess(asTransactionListItem(res.data))
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Transfer could not be completed.')
    },
  })

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (TRANSFER_UI_MOCK) {
        await new Promise((r) => setTimeout(r, 180))
        return { data: { detail: 'mock' } }
      }
      const v = transferForm.getValues()
      return transactionsApi.transferSendOtp({
        from_account_id: v.account_id,
        to_account_id: effectiveToAccountId(v.transfer_type, v.to_account_id),
        amount: v.amount,
        transfer_type: v.transfer_type,
        ...(v.transfer_type === 'TRANSFER_INTERNATIONAL'
          ? { international_details: buildInternationalDetails(v) }
          : {}),
      })
    },
    onSuccess: () => {
      setTransferOtpSent(true)
      setOtpValiditySecondsLeft(TRANSFER_OTP_VALIDITY_SEC)
      toast.success(
        TRANSFER_UI_MOCK
          ? `Demo mode: no email sent — use transfer code ${MOCK_TRANSFER_OTP}.`
          : 'We sent a 6-digit code to your email. It expires in 5 minutes.',
      )
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Could not send verification code.')
    },
  })

  const sendTransferOtp = useCallback(() => {
    if (sendOtpMutation.isPending || otpValiditySecondsLeft > 0) return
    sendOtpMutation.mutate()
  }, [sendOtpMutation, otpValiditySecondsLeft])

  const fillInternationalSample = () => {
    transferForm.reset({
      transfer_type: 'TRANSFER_INTERNATIONAL',
      account_id: MOCK_ACCOUNTS[0].id,
      ...SAMPLE_INTERNATIONAL_WIRE,
    })
    toast.success('Sample international wire fields applied.')
  }

  const handleTransferBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const transferSuccess = step === 3 && tab === 'transfer'
  const transferChrome = useMemo(
    () =>
      transferSuccess
        ? {
            showBack: true,
            backLabel: 'Back to transactions',
            onBack: () => navigate('/transactions'),
          }
        : {
            showBack: true,
            backLabel: 'Back',
            onBack: handleTransferBack,
          },
    [transferSuccess, step, handleTransferBack, navigate],
  )
  usePageChrome(transferChrome)

  const confirmTransfer = transferForm.handleSubmit((d) => {
    if (!regulatedSessionIdempotencyRef.current) {
      regulatedSessionIdempotencyRef.current = uuidv4()
    }
    if (preview?.requires_regulated_session) {
      const o = transferOtp.replace(/\D/g, '').slice(0, 6)
      if (o.length !== 6) {
        toast.error('Enter the 6-digit transfer code from your email.')
        return
      }
      setComplianceModalOpen(true)
      intlSessionMutation.mutate(o)
      return
    }
    const needsDomesticOtp =
      d.transfer_type === 'TRANSFER_INTERNAL' || d.transfer_type === 'TRANSFER_EXTERNAL'
    if (needsDomesticOtp || preview?.requires_otp) {
      const o = transferOtp.replace(/\D/g, '').slice(0, 6)
      if (o.length !== 6) {
        toast.error('Enter the 6-digit code from your email.')
        return
      }
      transferMutation.mutate({ ...d, otp: o })
      return
    }
    transferMutation.mutate(d)
  })

  const proceedCard = cardForm.handleSubmit(() => setCardUnavailableModalOpen(true))

  const resetAll = () => {
    transferForm.reset({
      transfer_type: 'TRANSFER_INTERNAL',
      account_id: '',
      to_account_id: '',
      account_holder_name: '',
      external_bank_name: '',
      amount: '',
      description: '',
      ...internationalFieldDefaults,
    })
    cardForm.reset()
    resetTransferOtpFlow()
    setRegulatedSessionId(null)
    regulatedSessionIdempotencyRef.current = null
    setComplianceModalOpen(false)
    setCompletedUetr(null)
    setCompletedTransaction(null)
    setStep(1)
  }

  const switchTab = (next: FlowTab) => {
    setTab(next)
    setStep(1)
    resetTransferOtpFlow()
    setRegulatedSessionId(null)
    regulatedSessionIdempotencyRef.current = null
    setComplianceModalOpen(false)
    transferForm.clearErrors()
    cardForm.clearErrors()
    setCardUnavailableModalOpen(false)
  }

  const fromAcc = accountById(tWatch.account_id || '')
  const insufficientFundsStep1 =
    !!fromAcc && amountExceedsBalance(tWatch.amount, fromAcc.balance)
  const insufficientFundsMessage = insufficientFundsStep1
    ? `Insufficient funds. Available balance is ${formatDisplayCurrency(fromAcc!.balance)}.`
    : undefined
  const amountDisplayError =
    transferForm.formState.errors.amount?.message || insufficientFundsMessage
  const insufficientFundsStep2 =
    !!fromAcc &&
    !!preview &&
    parseMoneyAmount(preview.total_debit) != null &&
    amountExceedsBalance(preview.total_debit, fromAcc.balance)
  const toAccountRaw = tWatch.to_account_id || ''
  const domesticAccountDisplay = isValidUaeIban(toAccountRaw)
    ? formatUaeIban(toAccountRaw)
    : formatDomesticAccountNumber(normalizeDestinationAccountNumber(toAccountRaw))
  const toDisplay =
    tab === 'transfer' && preview
      ? tWatch.transfer_type === 'TRANSFER_INTERNATIONAL'
        ? tWatch.beneficiary_legal_name?.trim() ||
          `${preview.destination.account_type} ···· ${preview.destination.last_four}`
        : [
            tWatch.account_holder_name?.trim() || '—',
            preview.destination.account_number || domesticAccountDisplay || '—',
            tWatch.transfer_type === 'TRANSFER_EXTERNAL' && tWatch.external_bank_name?.trim()
              ? tWatch.external_bank_name.trim()
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
      : tWatch.transfer_type === 'TRANSFER_INTERNATIONAL'
        ? tWatch.beneficiary_legal_name?.trim() || 'International beneficiary'
        : [
            tWatch.account_holder_name?.trim() || '—',
            domesticAccountDisplay || tWatch.to_account_id?.trim() || '—',
            tWatch.transfer_type === 'TRANSFER_EXTERNAL' && tWatch.external_bank_name?.trim()
              ? tWatch.external_bank_name.trim()
              : null,
          ]
            .filter(Boolean)
            .join(' · ')

  const reviewNeedsTransferOtp =
    !!preview &&
    (tWatch.transfer_type === 'TRANSFER_INTERNAL' ||
      tWatch.transfer_type === 'TRANSFER_EXTERNAL' ||
      preview.requires_otp === true ||
      preview.requires_regulated_session === true)

  const transferOtpAutoKey = useMemo(() => {
    if (step !== 1 || !previewEnabled) return ''
    return [
      tWatch.account_id,
      tWatch.amount,
      tWatch.transfer_type,
      effectiveToAccountId(tWatch.transfer_type, tWatch.to_account_id),
    ].join('|')
  }, [step, previewEnabled, tWatch.account_id, tWatch.amount, tWatch.transfer_type, tWatch.to_account_id])

  useEffect(() => {
    if (
      !insufficientFundsStep1 &&
      transferForm.formState.errors.amount?.type === 'manual'
    ) {
      transferForm.clearErrors('amount')
    }
  }, [insufficientFundsStep1])

  useEffect(() => {
    if (otpValiditySecondsLeft <= 0) return
    const id = window.setInterval(() => {
      setOtpValiditySecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [otpValiditySecondsLeft > 0])

  useEffect(() => {
    if (!transferOtpAutoKey) return
    setTransferOtpSent(false)
    setOtpValiditySecondsLeft(0)
    setTransferOtp('')
  }, [transferOtpAutoKey])

  const previewFeesNonCompliance =
    preview?.fees?.filter(
      (f) =>
        f.line_kind !== 'compliance' &&
        (f.is_rate || parseFloat(String(f.amount).replace(/,/g, '')) > 0),
    ) ?? []

  return (
    <div className="mx-auto max-w-4xl pb-10">
      {TRANSFER_UI_MOCK ? (
        <div className="mb-5 rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <p className="font-semibold text-amber-950">UI demo mode (backend paused)</p>
              <p className="text-xs leading-relaxed text-amber-900/90">
                Preview, fees, email OTP, compliance lines, and completion run on mock data so you can review every
                field and step. Set <code className="rounded bg-amber-100/80 px-1">TRANSFER_UI_MOCK = false</code> in{' '}
                <code className="rounded bg-amber-100/80 px-1">transferMock.ts</code> when the API is ready.
              </p>
              <p className="text-xs text-amber-900/85">
                Demo transfer code: <code className="font-mono font-semibold">{MOCK_TRANSFER_OTP}</code> ·
                Compliance code (each line):{' '}
                <code className="font-mono font-semibold">{MOCK_COMPLIANCE_OTP}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={fillInternationalSample}
              className="shrink-0 rounded-xl border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/50"
            >
              Fill sample international data
            </button>
          </div>
        </div>
      ) : null}

      {!(step === 3 && tab === 'transfer') ? (
        <div className="overflow-hidden rounded-t-2xl border border-b-0 border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
          <div className="flex items-center justify-between gap-3 bg-primary-dark px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Transfer</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent/90">Secure payments</p>
            </div>
            {tab === 'transfer' ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                    step === 1 ? 'bg-accent text-primary-dark' : 'bg-white/15 text-white/60',
                  )}
                >
                  1
                </span>
                <div className={cn('h-0.5 w-5 rounded-full', step === 3 ? 'bg-accent' : 'bg-white/20')} />
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                    step === 3 ? 'bg-accent text-primary-dark' : 'bg-white/15 text-white/60',
                  )}
                >
                  ✓
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 3 && tab === 'transfer' && completedTransaction ? (
        <TransferSuccessReceipt
          transaction={completedTransaction}
          uetr={completedUetr}
          demoNote={
            TRANSFER_UI_MOCK
              ? 'Demo only — no API call and no ledger change.'
              : null
          }
          onDashboard={() => navigate('/dashboard')}
          onAnother={resetAll}
        />
      ) : step === 3 && tab === 'transfer' ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div
          className={cn(
            'relative -mt-px overflow-hidden rounded-b-2xl border border-t-0 border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.06)]',
            complianceModalOpen && tab === 'transfer' && step === 1 && 'min-h-[min(85vh,720px)]',
            tab === 'card' && cardUnavailableModalOpen && 'min-h-[min(70vh,640px)]',
          )}
        >
          {step === 1 && (
            <div className="border-b border-gray-100 bg-[#f4f5f7] p-2 sm:p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchTab('transfer')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
                    tab === 'transfer'
                      ? 'bg-primary-dark text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200/80 hover:text-gray-900',
                  )}
                >
                  <Landmark size={18} strokeWidth={1.75} />
                  Bank transfer
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('card')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
                    tab === 'card'
                      ? 'bg-primary-dark text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200/80 hover:text-gray-900',
                  )}
                >
                  <CreditCard size={18} strokeWidth={1.75} />
                  Card deposit
                </button>
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            {tab === 'transfer' && step === 1 && (
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <StyledSelect
                  label="From account"
                  error={transferForm.formState.errors.account_id?.message}
                  {...transferForm.register('account_id')}
                >
                  <option value="">Select account</option>
                  {accounts.map((a: { id: string; account_number: string; iban?: string | null; account_type: string; balance: string }) => (
                    <option key={a.id} value={a.id}>
                      {a.account_type} · {(a.iban || a.account_number).slice(-4)} · {formatDisplayCurrency(a.balance)}
                    </option>
                  ))}
                </StyledSelect>

                <StyledSelect
                  label="Transfer type"
                  {...transferForm.register('transfer_type', {
                    onChange: (e) => {
                      const next = e.target.value
                      if (next === 'TRANSFER_INTERNATIONAL') {
                        transferForm.setValue('to_account_id', '')
                        transferForm.clearErrors('to_account_id')
                      }
                    },
                  })}
                >
                  <option value="TRANSFER_INTERNAL">Internal transfer</option>
                  <option value="TRANSFER_EXTERNAL">External transfer</option>
                  <option value="TRANSFER_INTERNATIONAL">International transfer</option>
                </StyledSelect>

                {tWatch.transfer_type !== 'TRANSFER_INTERNATIONAL' && (
                  <>
                    <Input
                      label="Account holder name"
                      placeholder="Name on the recipient account"
                      error={transferForm.formState.errors.account_holder_name?.message}
                      {...transferForm.register('account_holder_name')}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        To account{' '}
                        <span className="font-normal normal-case text-gray-400">
                          ({DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH}–{DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH} digits)
                        </span>
                      </label>
                      <input
                        className="input-field font-mono text-sm tracking-wide"
                      placeholder="Account number"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH}
                        {...transferForm.register('to_account_id')}
                      />
                      {transferForm.formState.errors.to_account_id && (
                        <p className="text-xs text-red-600">{transferForm.formState.errors.to_account_id.message}</p>
                      )}
                    </div>
                    {tWatch.transfer_type === 'TRANSFER_EXTERNAL' && (
                      <Input
                        label="Bank name"
                        placeholder="Recipient bank"
                        error={transferForm.formState.errors.external_bank_name?.message}
                        {...transferForm.register('external_bank_name')}
                      />
                    )}
                  </>
                )}

                {tWatch.transfer_type === 'TRANSFER_INTERNATIONAL' && (
                  <InternationalTransferFormSections
                    register={
                      transferForm.register as unknown as UseFormRegister<InternationalTransferFormValues>
                    }
                    setValue={
                      transferForm.setValue as unknown as UseFormSetValue<InternationalTransferFormValues>
                    }
                    errors={
                      transferForm.formState.errors as FieldErrors<InternationalTransferFormValues>
                    }
                    watch={transferForm.watch as unknown as UseFormWatch<InternationalTransferFormValues>}
                    amountBalanceError={insufficientFundsMessage}
                  />
                )}

                {tWatch.transfer_type !== 'TRANSFER_INTERNATIONAL' && (
                  <Input
                    label="Amount"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    min="0.01"
                    error={amountDisplayError}
                    {...transferForm.register('amount')}
                  />
                )}
                <Input label="Note (optional)" placeholder="What is this payment for?" {...transferForm.register('description')} />

                {previewEnabled ? (
                  <div className="space-y-6 border-t border-gray-100 pt-6">
                    <h2 className="text-lg font-semibold text-gray-900">Fees &amp; confirmation</h2>

                    <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50/50">
                      <div className="flex justify-between gap-4 px-4 py-3">
                        <dt className="text-sm text-gray-500">From</dt>
                        <dd className="text-right text-sm font-medium text-gray-900">
                          {fromAcc ? (
                            <>
                              {fromAcc.account_type} ···· {fromAcc.account_number.slice(-4)}
                            </>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 px-4 py-3">
                        <dt className="text-sm text-gray-500">To</dt>
                        <dd className="text-right text-sm font-medium text-gray-900">{toDisplay}</dd>
                      </div>
                      <div className="flex justify-between gap-4 px-4 py-3">
                        <dt className="text-sm text-gray-500">You send</dt>
                        <dd className="text-sm font-semibold tabular-nums text-gray-900">
                          {tWatch.transfer_type === 'TRANSFER_INTERNATIONAL'
                            ? `${formatDisplayCurrency(tWatch.amount || '0')} ${tWatch.transfer_currency}`
                            : formatDisplayCurrency(tWatch.amount || '0')}
                        </dd>
                      </div>
                    </dl>

                    <div className="rounded-2xl border border-primary-dark/15 bg-primary-dark/[0.04] px-4 py-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-dark">
                        <Building2 size={14} />
                        Fees &amp; settlement
                      </div>
                      {previewLoading ? (
                        <div className="mt-4 flex justify-center py-6">
                          <Spinner />
                        </div>
                      ) : internationalPreviewHint ? (
                        <p className="mt-3 text-sm leading-relaxed text-gray-600">{internationalPreviewHint}</p>
                      ) : previewError || !preview ? (
                        <p className="mt-3 text-sm text-amber-800">
                          {transferPreviewErrorMessage(previewQueryError) ||
                            'Could not calculate fees. Check the destination account and amount.'}
                        </p>
                      ) : (
                        <>
                          <ul className="mt-3 space-y-2">
                            {previewFeesNonCompliance.map((line) => (
                              <li key={line.code + line.label} className="flex justify-between gap-3 text-sm">
                                <span className="text-gray-600">{line.label}</span>
                                <span className="font-mono tabular-nums text-gray-900">
                                  {line.is_rate ? line.amount : formatDisplayCurrency(line.amount)}
                                </span>
                              </li>
                            ))}
                            {preview.currency !== preview.credited_currency ||
                            (preview.fee_billing === 'net_of_recipient' && parseFloat(preview.fee_total || '0') > 0) ? (
                              <li className="flex justify-between gap-3 border-t border-gray-200/80 pt-2 text-sm">
                                <span className="text-gray-600">Recipient receives (approx.)</span>
                                <span className="font-semibold tabular-nums text-gray-900">
                                  {formatDisplayCurrency(preview.credited_amount)} {preview.credited_currency}
                                </span>
                              </li>
                            ) : null}
                          </ul>

                          {reviewNeedsTransferOtp ? (
                            <div className="mt-4 space-y-2 border-t border-gray-200/80 pt-4 text-sm">
                              <p className="text-gray-700">
                                This transfer requires email verification. Click Send OTP to receive a 6-digit code
                                (valid for 5 minutes), then enter it below.
                              </p>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="flex min-w-[9.5rem] shrink-0 items-center sm:justify-center">
                                  {sendOtpMutation.isPending ? (
                                    <span className="text-xs font-medium text-gray-500">Sending code…</span>
                                  ) : transferOtpSent && otpValiditySecondsLeft > 0 ? (
                                    <span className="text-xs font-medium tabular-nums text-gray-500">
                                      Code expires in{' '}
                                      {`${Math.floor(otpValiditySecondsLeft / 60)}:${String(otpValiditySecondsLeft % 60).padStart(2, '0')}`}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={previewLoading || !preview}
                                      onClick={sendTransferOtp}
                                      className="btn-outline px-4 py-2 text-xs font-semibold"
                                    >
                                      {transferOtpSent ? 'Resend OTP' : 'Send OTP'}
                                    </button>
                                  )}
                                </div>
                                <input
                                  className="input-field max-w-xs font-mono text-sm tracking-widest"
                                  placeholder="6-digit code"
                                  inputMode="numeric"
                                  maxLength={8}
                                  autoComplete="one-time-code"
                                  disabled={!transferOtpSent}
                                  value={transferOtp}
                                  onChange={(e) => setTransferOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                              </div>
                              {TRANSFER_UI_MOCK && reviewNeedsTransferOtp ? (
                                <p className="text-xs text-violet-900/90">
                                  Demo: use transfer code{' '}
                                  <code className="rounded bg-violet-100/90 px-1.5 py-0.5 font-mono font-semibold">
                                    {MOCK_TRANSFER_OTP}
                                  </code>
                                  .
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="mt-4 flex justify-between gap-3 border-t border-primary-dark/10 pt-3 text-base font-bold text-primary-dark">
                            <span>Total debited from your account</span>
                            <span className="tabular-nums">{formatDisplayCurrency(preview.total_debit)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        transferMutation.isPending ||
                        intlSessionMutation.isPending ||
                        previewLoading ||
                        !preview ||
                        insufficientFundsStep1 ||
                        insufficientFundsStep2 ||
                        (reviewNeedsTransferOtp && (!transferOtpSent || transferOtp.length !== 6))
                      }
                      onClick={() => confirmTransfer()}
                      className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {(transferMutation.isPending || intlSessionMutation.isPending) && (
                        <Spinner size="sm" className="border-white border-t-white/30" />
                      )}
                      Confirm &amp; send
                    </button>
                  </div>
                ) : (
                  <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    Complete all required fields above to see fees and confirm your transfer.
                  </p>
                )}
              </form>
            )}

            {tab === 'card' && step === 1 && (
              <form
                className="space-y-6"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-dark via-[#134d3a] to-[#0a2e24] p-5 text-white shadow-lg ring-1 ring-white/10">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/25 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-8 left-1/3 h-24 w-24 rounded-full bg-white/5 blur-xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Card deposit</p>
                      <p className="mt-3 font-mono text-lg tracking-[0.2em] text-white/95 sm:text-xl">
                        {panDigits.length >= 4 ? formatPanInput(panDigits) : '•••• •••• •••• ••••'}
                      </p>
                      <p className="mt-4 text-sm font-medium text-white/90">
                        {cWatch.cardholder?.trim() || 'Name on card'}
                      </p>
                      <p className="mt-1 font-mono text-xs text-white/50">{cWatch.expiry?.trim() || 'MM / YY'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <CreditCard className="h-8 w-8 text-accent/90" strokeWidth={1.5} aria-hidden />
                      {panDigits.length >= 4 ? (
                        <span className={cardBrandBadgeClass(cardBrand)}>{cardBrandLabel(cardBrand)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/90 to-white p-5 shadow-sm ring-1 ring-gray-100/80">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-dark/10 text-primary-dark">
                      <Lock size={16} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Payment details</p>
                      <p className="text-xs text-gray-500">Funds are credited to your selected account</p>
                    </div>
                  </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Credit to account</label>
                  <select className="input-field text-sm" {...cardForm.register('deposit_account_id')}>
                    <option value="">Select account</option>
                    {accounts.map((a: { id: string; account_number: string; iban?: string | null; account_type: string; balance: string }) => (
                      <option key={a.id} value={a.id}>
                        {a.account_type} · ····{(a.iban || a.account_number).slice(-4)}
                      </option>
                    ))}
                  </select>
                  {cardForm.formState.errors.deposit_account_id && (
                    <p className="text-xs text-red-600">{cardForm.formState.errors.deposit_account_id.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="deposit-pan" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Payment number
                  </label>
                  <div className="relative">
                    <input
                      id="deposit-pan"
                      className="input-field w-full pr-28 font-mono text-sm tracking-widest"
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      autoComplete="new-password"
                      data-1p-ignore
                      {...cardForm.register('pan', {
                        onChange: (e) => {
                          e.target.value = formatPanInput(e.target.value)
                        },
                      })}
                    />
                    {panDigits.length >= 4 ? (
                      <span
                        className={cn(
                          'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2',
                          cardBrandBadgeClass(cardBrand),
                        )}
                      >
                        {cardBrandLabel(cardBrand)}
                      </span>
                    ) : null}
                  </div>
                  {cardForm.formState.errors.pan && (
                    <p className="text-xs text-red-600">{cardForm.formState.errors.pan.message}</p>
                  )}
                </div>

                <Input
                  id="deposit-holder"
                  label="Account holder name"
                  placeholder="Full name"
                  autoComplete="name"
                  data-1p-ignore
                  {...cardForm.register('cardholder')}
                  error={cardForm.formState.errors.cardholder?.message}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="deposit-expiry" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Valid thru
                    </label>
                    <input
                      id="deposit-expiry"
                      className="input-field font-mono text-sm"
                      placeholder="MM / YY"
                      inputMode="numeric"
                      autoComplete="new-password"
                      data-1p-ignore
                      {...cardForm.register('expiry', {
                        onChange: (e) => {
                          const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                          e.target.value = d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
                        },
                      })}
                    />
                    {cardForm.formState.errors.expiry && (
                      <p className="text-xs text-red-600">{cardForm.formState.errors.expiry.message}</p>
                    )}
                  </div>
                  <Input
                    id="deposit-cvv"
                    label="Security code"
                    type="password"
                    placeholder="3–4 digits"
                    autoComplete="new-password"
                    data-1p-ignore
                    maxLength={4}
                    error={cardForm.formState.errors.cvv?.message}
                    {...cardForm.register('cvv')}
                  />
                </div>
                </div>

                <button
                  type="button"
                  onClick={proceedCard}
                  className="btn-primary w-full py-3.5 text-sm font-semibold shadow-lg shadow-primary-dark/20 transition hover:shadow-xl hover:shadow-primary-dark/25"
                >
                  Proceed
                </button>
              </form>
            )}

          </div>

          {tab === 'card' && cardUnavailableModalOpen && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-primary-dark/55 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="card-unavailable-title"
            >
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl ring-1 ring-black/5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-50/90 to-transparent" />
            <button
              type="button"
              onClick={() => setCardUnavailableModalOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="relative px-6 pb-6 pt-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 shadow-inner ring-4 ring-amber-100/80">
                <AlertTriangle className="h-8 w-8 text-amber-600" strokeWidth={1.75} aria-hidden />
              </div>
                  <h3 id="card-unavailable-title" className="mt-5 text-xl font-bold tracking-tight text-gray-900">
                    Service unavailable
                  </h3>
              <p className="mx-auto mt-3 max-w-[17rem] text-sm leading-relaxed text-gray-600">
                Card deposits are currently unavailable. Please try again later or fund your account with a bank
                transfer.
              </p>
              <button
                type="button"
                onClick={() => setCardUnavailableModalOpen(false)}
                className="btn-primary mx-auto mt-6 w-full max-w-[12rem] py-2.5 text-sm font-semibold shadow-md"
              >
                OK
              </button>
            </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ComplianceFeesModal
        open={complianceModalOpen}
        sessionId={regulatedSessionId}
        onClose={() => {
          setComplianceModalOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['transactions'] })
        }}
        onCompleted={(tx) => finishTransferSuccess(tx)}
      />
    </div>
  )
}
