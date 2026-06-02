import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Settings, Trash2, Bitcoin, Landmark } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/store/authStore'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { AdminModal, AdminModalActions } from '@/components/admin/AdminModal'
import ComplianceExemptionPanel from '@/components/admin/ComplianceExemptionPanel'
import { adminApiErrorMessage, buildComplianceFeePayload } from '@/lib/adminApiErrors'
import { fromAdminListResponse } from '@/lib/adminList'
import { cn } from '@/utils/cn'
import { LocationCombobox } from '@/components/forms/LocationCombobox'
import { useCountryComboboxDraft, useCountryOptions, useLocationDataset } from '@/lib/locationData'
import {
  complianceCustomerMessage,
  complianceMessageForSave,
  DEFAULT_COMPLIANCE_CUSTOMER_MESSAGE,
} from '@/constants/compliance'

type TxFee = {
  id: number
  fee_type: string
  flat_amount: string
  percentage: string
  min_amount: string
  max_amount: string
  is_active: boolean
  requires_otp: boolean
  charge_upfront: boolean
}

const ALL_FEE_TYPES = [
  'TRANSFER_LOCAL',
  'TRANSFER_INTERNATIONAL',
  'WITHDRAWAL',
  'DEPOSIT',
  'SERVICE_CHARGE',
] as const

type RateRow = {
  id: number
  from_currency: string
  to_currency: string
  rate: string
  fetched_at: string
}

type ComplianceFeeLineRow = {
  id: string
  name: string
  customer_message?: string
  code: string
  applies_to: string
  min_principal_threshold: string
  sort_order: number
  flat_amount: string
  percentage: string
  min_amount: string
  max_amount: string
  is_active: boolean
  user?: string | null
  user_email?: string | null
  user_full_name?: string | null
  scope?: 'global' | 'user'
  payment_crypto_enabled?: boolean
  payment_wire_enabled?: boolean
  wire_beneficiary_name?: string
  wire_bank_name?: string
  wire_bank_address?: string
  wire_swift_bic?: string
  wire_iban?: string
  wire_account_number?: string
  wire_country?: string
  custom_payment_reference?: string
  crypto_btc_address?: string
  crypto_eth_address?: string
  crypto_usdt_erc20?: string
  crypto_usdt_trc20?: string
  crypto_usdt_bep20?: string
}

type AdminUserOption = {
  id: string
  email: string
  full_name: string
}

const APPLIES_OPTIONS = [
  { value: 'INTERNATIONAL_TRANSFER', label: 'International transfer' },
  { value: 'LOAN_PAYOUT', label: 'Loan payout' },
  { value: 'BOTH', label: 'Both' },
] as const

function appliesLabel(v: string): string {
  return APPLIES_OPTIONS.find((o) => o.value === v)?.label ?? v
}

function formatCompliancePricing(row: Pick<ComplianceFeeLineRow, 'flat_amount' | 'percentage'>) {
  const flat = parseFloat(row.flat_amount)
  const pct = parseFloat(pctDisplay(row.percentage))
  if (flat > 0 && pct > 0) {
    return `${formatDisplayCurrency(row.flat_amount)} flat + ${pctDisplay(row.percentage)}%`
  }
  if (flat > 0) return `${formatDisplayCurrency(row.flat_amount)} flat`
  if (pct > 0) return `${pctDisplay(row.percentage)}% of principal`
  return 'No charge'
}

type ComplianceFormState = {
  scope: 'global' | 'user'
  user_id: string
  name: string
  customer_message: string
  code: string
  applies_to: string
  flat_amount: string
  percentage_percent: string
  is_active: boolean
  payment_crypto_enabled: boolean
  payment_wire_enabled: boolean
  wire_beneficiary_name: string
  wire_bank_name: string
  wire_bank_address: string
  wire_swift_bic: string
  wire_iban: string
  wire_account_number: string
  wire_country: string
  custom_payment_reference: string
  crypto_btc_address: string
  crypto_eth_address: string
  crypto_usdt_erc20: string
  crypto_usdt_trc20: string
  crypto_usdt_bep20: string
}

function emptyCompliancePaymentFields(): Pick<
  ComplianceFormState,
  | 'payment_crypto_enabled'
  | 'payment_wire_enabled'
  | 'wire_beneficiary_name'
  | 'wire_bank_name'
  | 'wire_bank_address'
  | 'wire_swift_bic'
  | 'wire_iban'
  | 'wire_account_number'
  | 'wire_country'
  | 'custom_payment_reference'
  | 'crypto_btc_address'
  | 'crypto_eth_address'
  | 'crypto_usdt_erc20'
  | 'crypto_usdt_trc20'
  | 'crypto_usdt_bep20'
> {
  return {
    payment_crypto_enabled: false,
    payment_wire_enabled: false,
    wire_beneficiary_name: '',
    wire_bank_name: '',
    wire_bank_address: '',
    wire_swift_bic: '',
    wire_iban: '',
    wire_account_number: '',
    wire_country: '',
    custom_payment_reference: '',
    crypto_btc_address: '',
    crypto_eth_address: '',
    crypto_usdt_erc20: '',
    crypto_usdt_trc20: '',
    crypto_usdt_bep20: '',
  }
}

function compliancePaymentFieldsFromRow(row: ComplianceFeeLineRow) {
  return {
    payment_crypto_enabled: row.payment_crypto_enabled ?? false,
    payment_wire_enabled: row.payment_wire_enabled ?? false,
    wire_beneficiary_name: row.wire_beneficiary_name ?? '',
    wire_bank_name: row.wire_bank_name ?? '',
    wire_bank_address: row.wire_bank_address ?? '',
    wire_swift_bic: row.wire_swift_bic ?? '',
    wire_iban: row.wire_iban ?? '',
    wire_account_number: row.wire_account_number ?? '',
    wire_country: row.wire_country ?? '',
    custom_payment_reference: row.custom_payment_reference ?? '',
    crypto_btc_address: row.crypto_btc_address ?? '',
    crypto_eth_address: row.crypto_eth_address ?? '',
    crypto_usdt_erc20: row.crypto_usdt_erc20 ?? '',
    crypto_usdt_trc20: row.crypto_usdt_trc20 ?? '',
    crypto_usdt_bep20: row.crypto_usdt_bep20 ?? '',
  }
}

function slugifyCode(input: string, fallbackName: string): string {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (raw) return raw.slice(0, 40)
  const fromName = fallbackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return fromName || 'fee-line'
}

function pctToDecimal(percentInput: string): string {
  const n = parseFloat(percentInput.replace(',', '.'))
  if (Number.isNaN(n)) return '0'
  return String(n / 100)
}

function pctDisplay(percentage: string | null | undefined): string {
  const n = parseFloat(String(percentage ?? '0'))
  if (Number.isNaN(n)) return '0.00'
  return (n * 100).toFixed(2)
}

type ComplianceExternalPaymentProps = {
  form: ComplianceFormState
  setForm: Dispatch<SetStateAction<ComplianceFormState>>
}

function ComplianceExternalPaymentSection({ form, setForm }: ComplianceExternalPaymentProps) {
  const patch = (fields: Partial<ComplianceFormState>) => setForm((s) => ({ ...s, ...fields }))
  const { data: csc, isLoading: locationLoading } = useLocationDataset()
  const countryOptions = useCountryOptions(csc)
  const { draft: wireCountryDraft, onChange: handleWireCountryChange } = useCountryComboboxDraft(
    form.wire_country,
    csc,
    (iso) => patch({ wire_country: iso }),
  )

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-900">External payment</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
          Customers pay this fee outside SafaPay. Turn on one or both methods below and complete only the section(s)
          you enable.
        </p>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-xl border transition-colors',
          form.payment_crypto_enabled
            ? 'border-amber-200/90 bg-amber-50/30'
            : 'border-gray-200 bg-white',
        )}
      >
        <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-dark focus:ring-primary-dark/30"
            checked={form.payment_crypto_enabled}
            onChange={(e) => patch({ payment_crypto_enabled: e.target.checked })}
          />
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Bitcoin size={16} className="text-amber-700" aria-hidden />
              Cryptocurrency
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
              Wallet addresses for BTC, ETH, and USDT. Add at least one address when enabled.
            </span>
          </span>
        </label>

        {form.payment_crypto_enabled ? (
          <div className="space-y-4 border-t border-amber-200/70 px-4 pb-4 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Bitcoin & Ethereum</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">BTC address</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-xs"
                    placeholder="bc1… or legacy address"
                    value={form.crypto_btc_address}
                    onChange={(e) => patch({ crypto_btc_address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">ETH address</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-xs"
                    placeholder="0x…"
                    value={form.crypto_eth_address}
                    onChange={(e) => patch({ crypto_eth_address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">USDT by network</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-950/80">
                Use separate addresses per chain. Customers must send on the correct network.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">USDT (ERC-20 · Ethereum)</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-xs"
                    placeholder="0x…"
                    value={form.crypto_usdt_erc20}
                    onChange={(e) => patch({ crypto_usdt_erc20: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">USDT (TRC-20 · Tron)</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-xs"
                    placeholder="T…"
                    value={form.crypto_usdt_trc20}
                    onChange={(e) => patch({ crypto_usdt_trc20: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700">USDT (BEP-20 · BNB Chain)</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-xs"
                    placeholder="0x…"
                    value={form.crypto_usdt_bep20}
                    onChange={(e) => patch({ crypto_usdt_bep20: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-xl border transition-colors',
          form.payment_wire_enabled ? 'border-sky-200/90 bg-sky-50/30' : 'border-gray-200 bg-white',
        )}
      >
        <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-dark focus:ring-primary-dark/30"
            checked={form.payment_wire_enabled}
            onChange={(e) => patch({ payment_wire_enabled: e.target.checked })}
          />
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Landmark size={16} className="text-sky-700" aria-hidden />
              Bank wire (SWIFT)
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
              International wire instructions shown to the customer. SWIFT/BIC and IBAN or account number are required
              when enabled.
            </span>
          </span>
        </label>

        {form.payment_wire_enabled ? (
          <div className="space-y-4 border-t border-sky-200/70 px-4 pb-4 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Beneficiary</p>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-700">Beneficiary name</label>
                <input
                  className="input-field mt-1 w-full text-sm"
                  placeholder="Legal name on the account"
                  value={form.wire_beneficiary_name}
                  onChange={(e) => patch({ wire_beneficiary_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Receiving bank</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700">Bank name</label>
                  <input
                    className="input-field mt-1 w-full text-sm"
                    placeholder="Full legal bank name"
                    value={form.wire_bank_name}
                    onChange={(e) => patch({ wire_bank_name: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700">Bank address</label>
                  <textarea
                    className="input-field mt-1 min-h-[4.5rem] w-full resize-y text-sm"
                    placeholder="Street, city, postal code"
                    rows={2}
                    value={form.wire_bank_address}
                    onChange={(e) => patch({ wire_bank_address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">SWIFT / BIC</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-sm uppercase"
                    placeholder="8 or 11 characters"
                    value={form.wire_swift_bic}
                    onChange={(e) => patch({ wire_swift_bic: e.target.value })}
                  />
                </div>
                <div>
                  <LocationCombobox
                    label="Bank country"
                    value={wireCountryDraft}
                    onChange={handleWireCountryChange}
                    options={countryOptions}
                    loading={locationLoading}
                    placeholder="Search country"
                    hint="Select a country from the list"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Account details</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-sky-950/80">
                Provide IBAN, account number, or both — at least one is required for customer payment.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">IBAN</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-sm"
                    placeholder="If applicable"
                    value={form.wire_iban}
                    onChange={(e) => patch({ wire_iban: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Account number</label>
                  <input
                    className="input-field mt-1 w-full font-mono text-sm"
                    placeholder="If no IBAN"
                    value={form.wire_account_number}
                    onChange={(e) => patch({ wire_account_number: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Payment reference</p>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-700">
                  Reference <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  className="input-field mt-1 w-full font-mono text-sm"
                  placeholder="Leave blank to auto-generate (e.g. CMP-LP-A1B2C3)"
                  maxLength={40}
                  value={form.custom_payment_reference}
                  onChange={(e) => patch({ custom_payment_reference: e.target.value })}
                />
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Shown on bank wire instructions only. Auto-generated if left empty.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!form.payment_crypto_enabled && !form.payment_wire_enabled ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
          Enable cryptocurrency and/or bank wire above before customers can pay this fee externally.
        </p>
      ) : null}
    </div>
  )
}

function yesNoBadge(yes: boolean) {
  return yes
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    : 'bg-gray-100 text-gray-600 ring-gray-200'
}

function activeBadge(active: boolean) {
  return active
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    : 'bg-red-50 text-red-800 ring-red-100'
}

function SectionPanel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-4 py-3 sm:px-6">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function panelBtnClass() {
  return 'inline-flex items-center gap-1 rounded-lg bg-primary-dark px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-light'
}

function ComplianceMessageEditor({
  row,
  saving,
  onSave,
}: {
  row: ComplianceFeeLineRow
  saving: boolean
  onSave: (id: string, customer_message: string) => void
}) {
  const [draft, setDraft] = useState(() => complianceCustomerMessage(row.customer_message))

  useEffect(() => {
    setDraft(complianceCustomerMessage(row.customer_message))
  }, [row.id, row.customer_message])

  const commit = () => {
    const nextStored = complianceMessageForSave(draft)
    const prevStored = (row.customer_message ?? '').trim()
    if (nextStored !== prevStored) {
      onSave(row.id, nextStored)
    }
  }

  return (
    <textarea
      className="input-field min-h-[3.25rem] w-full resize-y text-xs leading-relaxed text-gray-800"
      rows={2}
      value={draft}
      disabled={saving}
      placeholder={DEFAULT_COMPLIANCE_CUSTOMER_MESSAGE}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
      aria-label={`Customer message for ${row.name}`}
    />
  )
}

export default function AdminFeesPage() {
  const queryClient = useQueryClient()
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN')
  const [editingFee, setEditingFee] = useState<TxFee | null>(null)
  const [addingFee, setAddingFee] = useState(false)
  const [newFeeType, setNewFeeType] = useState<string>('')
  const [feeForm, setFeeForm] = useState({
    flat_amount: '',
    percentage_percent: '',
    min_amount: '',
    max_amount: '',
    is_active: true,
    requires_otp: false,
    charge_upfront: true,
  })
  const [editingRate, setEditingRate] = useState<RateRow | null>(null)
  const [rateDraft, setRateDraft] = useState('')

  const [editingCompliance, setEditingCompliance] = useState<ComplianceFeeLineRow | null>(null)
  const [addingCompliance, setAddingCompliance] = useState(false)
  const [complianceForm, setComplianceForm] = useState<ComplianceFormState>({
    scope: 'global',
    user_id: '',
    name: '',
    customer_message: '',
    code: '',
    applies_to: 'INTERNATIONAL_TRANSFER',
    flat_amount: '0',
    percentage_percent: '0',
    is_active: true,
    ...emptyCompliancePaymentFields(),
  })
  const [userFilterId, setUserFilterId] = useState('')

  const feesQuery = useQuery({ queryKey: ['admin-fees'], queryFn: () => adminApi.fees() })
  const ratesQuery = useQuery({ queryKey: ['admin-rates'], queryFn: () => adminApi.exchangeRates() })
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'compliance-picker'],
    queryFn: () => adminApi.users({ role: 'CUSTOMER', page_size: '500' }),
  })
  const complianceQuery = useQuery({
    queryKey: ['admin-compliance-fee-lines'],
    queryFn: () => adminApi.complianceFeeLines(),
  })

  const fees = fromAdminListResponse<TxFee>(feesQuery.data)
  const rates = fromAdminListResponse<RateRow>(ratesQuery.data)
  const complianceLines = fromAdminListResponse<ComplianceFeeLineRow>(complianceQuery.data)
  const adminUsers = fromAdminListResponse<AdminUserOption>(usersQuery.data)
  const globalComplianceLines = complianceLines.filter((r) => !r.user)
  const userComplianceLines = complianceLines.filter((r) => Boolean(r.user))
  const filteredUserComplianceLines = userFilterId
    ? userComplianceLines.filter((r) => r.user === userFilterId)
    : userComplianceLines

  const updateFeeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      adminApi.updateFee(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fees'] })
      setEditingFee(null)
      toast.success('Fee saved.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not save fee.'),
  })

  const createFeeMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminApi.createFee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fees'] })
      setAddingFee(false)
      setNewFeeType('')
      toast.success('Fee created.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not create fee.'),
  })

  const updateRateMutation = useMutation({
    mutationFn: ({ id, rate }: { id: number; rate: string }) => adminApi.updateRate(id, { rate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rates'] })
      setEditingRate(null)
      toast.success('Rate saved.')
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not save rate.'),
  })

  const createComplianceMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminApi.createComplianceFeeLine(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compliance-fee-lines'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-compliance-sessions'] })
      setAddingCompliance(false)
      toast.success('Fee line created. Active compliance sessions will pick it up when possible.')
    },
    onError: (err: unknown) => toast.error(adminApiErrorMessage(err, 'Could not create line.')),
  })

  const updateComplianceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => adminApi.updateComplianceFeeLine(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compliance-fee-lines'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-compliance-sessions'] })
      setEditingCompliance(null)
      toast.success('Fee line saved.')
    },
    onError: (err: unknown) => toast.error(adminApiErrorMessage(err, 'Could not save line.')),
  })

  const [savingMessageId, setSavingMessageId] = useState<string | null>(null)

  const patchComplianceMessageMutation = useMutation({
    mutationFn: ({ id, customer_message }: { id: string; customer_message: string }) =>
      adminApi.updateComplianceFeeLine(id, { customer_message }),
    onMutate: ({ id }) => {
      setSavingMessageId(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compliance-fee-lines'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-compliance-sessions'] })
    },
    onError: (err: unknown) => toast.error(adminApiErrorMessage(err, 'Could not save message.')),
    onSettled: () => {
      setSavingMessageId(null)
    },
  })

  const deleteComplianceMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteComplianceFeeLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-compliance-fee-lines'] })
      toast.success('Fee line deleted.')
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      const detail = typeof data === 'object' && data && 'detail' in data ? String((data as { detail: unknown }).detail) : null
      toast.error(detail || 'Could not delete fee line.')
    },
  })

  const handleDeleteCompliance = (row: ComplianceFeeLineRow) => {
    if (
      !window.confirm(
        `Delete compliance fee line "${row.name}"? This cannot be undone.`,
      )
    ) {
      return
    }
    deleteComplianceMutation.mutate(row.id)
  }

  const openEditFee = (f: TxFee) => {
    setEditingFee(f)
    setFeeForm({
      flat_amount: f.flat_amount,
      percentage_percent: pctDisplay(f.percentage),
      min_amount: f.min_amount,
      max_amount: f.max_amount,
      is_active: f.is_active,
      requires_otp: f.requires_otp ?? false,
      charge_upfront: f.charge_upfront !== false,
    })
  }

  const openAddFee = () => {
    setAddingFee(true)
    setNewFeeType('')
    setFeeForm({
      flat_amount: '0',
      percentage_percent: '0',
      min_amount: '0',
      max_amount: '0',
      is_active: true,
      requires_otp: false,
      charge_upfront: true,
    })
  }

  const unusedFeeTypes = ALL_FEE_TYPES.filter((t) => !fees.some((f) => f.fee_type === t))

  const buildFeePayload = (includeType: boolean) => {
    const base: Record<string, unknown> = {
      flat_amount: feeForm.flat_amount,
      percentage: pctToDecimal(feeForm.percentage_percent),
      min_amount: feeForm.min_amount,
      max_amount: feeForm.max_amount,
      is_active: feeForm.is_active,
      requires_otp: feeForm.requires_otp,
      charge_upfront: feeForm.charge_upfront,
    }
    if (includeType && newFeeType) base.fee_type = newFeeType
    return base
  }

  const buildCompliancePayload = () =>
    buildComplianceFeePayload({
      scope: complianceForm.scope,
      user_id: complianceForm.user_id,
      name: complianceForm.name,
      customer_message: complianceForm.customer_message,
      code: slugifyCode(complianceForm.code, complianceForm.name),
      applies_to: complianceForm.applies_to,
      flat_amount: complianceForm.flat_amount,
      percentage: pctToDecimal(complianceForm.percentage_percent),
      is_active: complianceForm.is_active,
      payment_crypto_enabled: complianceForm.payment_crypto_enabled,
      payment_wire_enabled: complianceForm.payment_wire_enabled,
      wire_beneficiary_name: complianceForm.wire_beneficiary_name,
      wire_bank_name: complianceForm.wire_bank_name,
      wire_bank_address: complianceForm.wire_bank_address,
      wire_swift_bic: complianceForm.wire_swift_bic,
      wire_iban: complianceForm.wire_iban,
      wire_account_number: complianceForm.wire_account_number,
      wire_country: complianceForm.wire_country,
      custom_payment_reference: complianceForm.custom_payment_reference,
      crypto_btc_address: complianceForm.crypto_btc_address,
      crypto_eth_address: complianceForm.crypto_eth_address,
      crypto_usdt_erc20: complianceForm.crypto_usdt_erc20,
      crypto_usdt_trc20: complianceForm.crypto_usdt_trc20,
      crypto_usdt_bep20: complianceForm.crypto_usdt_bep20,
    })

  const openEditCompliance = (row: ComplianceFeeLineRow) => {
    setEditingCompliance(row)
    setComplianceForm({
      scope: row.user ? 'user' : 'global',
      user_id: row.user ?? '',
      name: row.name,
      customer_message: complianceCustomerMessage(row.customer_message),
      code: row.code,
      applies_to: row.applies_to,
      flat_amount: row.flat_amount,
      percentage_percent: pctDisplay(row.percentage),
      is_active: row.is_active,
      ...compliancePaymentFieldsFromRow(row),
    })
  }

  const openAddCompliance = (scope: 'global' | 'user' = 'user', presetUserId = '') => {
    const effectiveScope = isSuperAdmin ? scope : 'user'
    setAddingCompliance(true)
    setComplianceForm({
      scope: effectiveScope,
      user_id: presetUserId,
      name: '',
      customer_message: '',
      code: '',
      applies_to: 'INTERNATIONAL_TRANSFER',
      flat_amount: '0',
      percentage_percent: '0',
      is_active: true,
      ...emptyCompliancePaymentFields(),
    })
  }

  const complianceRowActions = (row: ComplianceFeeLineRow) => (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        title="Edit"
        onClick={() => openEditCompliance(row)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-primary-dark/20 hover:text-primary-dark"
      >
        <Pencil size={14} aria-hidden />
        <span className="sr-only">Edit {row.name}</span>
      </button>
      <button
        type="button"
        title="Delete"
        onClick={() => handleDeleteCompliance(row)}
        disabled={deleteComplianceMutation.isPending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={14} aria-hidden />
        <span className="sr-only">Delete {row.name}</span>
      </button>
    </div>
  )

  const renderComplianceFields = (opts: { showScopePicker?: boolean; codeOptional?: boolean }) => (
    <div className="space-y-4">
      {opts.showScopePicker && isSuperAdmin ? (
        <div>
          <label className="text-xs font-medium text-gray-700">Scope</label>
          <select
            className="input-field mt-1 w-full text-sm"
            value={complianceForm.scope}
            onChange={(e) =>
              setComplianceForm((s) => ({
                ...s,
                scope: e.target.value as 'global' | 'user',
                user_id: e.target.value === 'global' ? '' : s.user_id,
              }))
            }
          >
            <option value="global">Global (all customers)</option>
            <option value="user">Per customer</option>
          </select>
        </div>
      ) : null}
      {complianceForm.scope === 'user' ? (
        <div>
          <label className="text-xs font-medium text-gray-700">Customer</label>
          <select
            className="input-field mt-1 w-full text-sm"
            value={complianceForm.user_id}
            onChange={(e) => setComplianceForm((s) => ({ ...s, user_id: e.target.value }))}
          >
            <option value="">Select customer</option>
            {adminUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-xs font-medium text-gray-700">Display name</label>
        <input
          className="input-field mt-1 w-full text-sm"
          value={complianceForm.name}
          onChange={(e) => setComplianceForm((s) => ({ ...s, name: e.target.value }))}
          placeholder="e.g. Insurance fee"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Customer message</label>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
          Shown below Generate code when the customer is not allowed to pay yet. Leave blank for the default
          authorization message.
        </p>
        <textarea
          className="input-field mt-1 min-h-[4.5rem] w-full resize-y text-sm"
          rows={3}
          value={complianceForm.customer_message}
          onChange={(e) => setComplianceForm((s) => ({ ...s, customer_message: e.target.value }))}
          placeholder={DEFAULT_COMPLIANCE_CUSTOMER_MESSAGE}
        />
      </div>
      <ComplianceExternalPaymentSection form={complianceForm} setForm={setComplianceForm} />
      <div>
        <label className="text-xs font-medium text-gray-700">
          {opts.codeOptional ? 'Code (optional)' : 'Code (slug, unique per scope)'}
        </label>
        <input
          className="input-field mt-1 w-full font-mono text-sm"
          value={complianceForm.code}
          onChange={(e) => setComplianceForm((s) => ({ ...s, code: e.target.value }))}
          placeholder="insurance-fee"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700">Applies to</label>
        <select
          className="input-field mt-1 w-full text-sm"
          value={complianceForm.applies_to}
          onChange={(e) => setComplianceForm((s) => ({ ...s, applies_to: e.target.value }))}
        >
          {APPLIES_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-gray-700">Flat amount</label>
          <input
            className="input-field mt-1 w-full text-sm"
            type="number"
            min={0}
            step="0.01"
            value={complianceForm.flat_amount}
            onChange={(e) => setComplianceForm((s) => ({ ...s, flat_amount: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700">Percentage (% of principal)</label>
          <input
            className="input-field mt-1 w-full text-sm"
            type="number"
            min={0}
            step="0.01"
            value={complianceForm.percentage_percent}
            onChange={(e) => setComplianceForm((s) => ({ ...s, percentage_percent: e.target.value }))}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={complianceForm.is_active}
          onChange={(e) => setComplianceForm((s) => ({ ...s, is_active: e.target.checked }))}
        />
        Active
      </label>
    </div>
  )

  const saveComplianceMessage = (id: string, customer_message: string) => {
    patchComplianceMessageMutation.mutate({ id, customer_message })
  }

  const renderComplianceList = (rows: ComplianceFeeLineRow[], showUserColumn: boolean) => (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-gray-200/90 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{row.name}</p>
                <p className="mt-0.5 text-xs text-gray-600">{formatCompliancePricing(row)}</p>
              </div>
              {complianceRowActions(row)}
            </div>
            {showUserColumn && row.user_email ? (
              <p className="mt-2 truncate text-xs text-gray-600" title={row.user_email}>
                {row.user_full_name ? `${row.user_full_name} · ` : ''}
                {row.user_email}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Applies</p>
            <p className="text-xs font-medium text-gray-800">{appliesLabel(row.applies_to)}</p>
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Customer message
              </p>
              <ComplianceMessageEditor
                row={row}
                saving={savingMessageId === row.id}
                onSave={saveComplianceMessage}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="admin-table-scroll hidden md:block">
        <table className="admin-data-table min-w-[720px]">
          <colgroup>
            <col style={{ width: showUserColumn ? '14%' : '16%' }} />
            {showUserColumn ? <col style={{ width: '18%' }} /> : null}
            <col style={{ width: showUserColumn ? '12%' : '14%' }} />
            <col style={{ width: showUserColumn ? '14%' : '16%' }} />
            <col style={{ width: showUserColumn ? '34%' : '42%' }} />
            <col style={{ width: '5.5rem' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              {showUserColumn ? <th>Customer</th> : null}
              <th>Applies</th>
              <th>Pricing</th>
              <th>Message</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
              >
                <td className="align-top font-medium text-gray-900">{row.name}</td>
                {showUserColumn ? (
                  <td className="max-w-0 align-top">
                    {row.user_email ? (
                      <p className="truncate text-xs text-gray-700" title={row.user_email}>
                        {row.user_email}
                      </p>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ) : null}
                <td className="align-top text-xs text-gray-700">{appliesLabel(row.applies_to)}</td>
                <td className="align-top text-xs text-gray-600">{formatCompliancePricing(row)}</td>
                <td className="align-top">
                  <ComplianceMessageEditor
                    row={row}
                    saving={savingMessageId === row.id}
                    onSave={saveComplianceMessage}
                  />
                </td>
                <td className="col-actions align-top">
                  <div className="flex justify-end">{complianceRowActions(row)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )

  const feeError = feesQuery.isError
  const ratesError = ratesQuery.isError
  const complianceError = complianceQuery.isError
  const errDetail = (feesQuery.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail

  return (
    <div className="admin-page space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Settings size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Fees &amp; rates</h1>
            <p className="text-xs text-gray-500">Transaction fees, compliance lines, and FX</p>
          </div>
        </div>
      </section>

      {feeError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load fees: {typeof errDetail === 'string' ? errDetail : 'check that you are signed in as staff.'}
        </div>
      ) : null}

      {complianceError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load compliance fee lines. Check that you are signed in as staff.
        </div>
      ) : null}

      <SectionPanel
        title="Transaction fees"
        action={
          unusedFeeTypes.length > 0 ? (
            <button type="button" onClick={openAddFee} className={panelBtnClass()}>
              <Plus size={14} aria-hidden />
              Add fee
            </button>
          ) : null
        }
      >
        {feesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {fees.map((f) => (
                <li key={f.id} className="rounded-xl border border-gray-200/90 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">{f.fee_type.replace(/_/g, ' ')}</p>
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => openEditFee(f)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm"
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {formatDisplayCurrency(f.flat_amount)} flat · {pctDisplay(f.percentage)}%
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1', activeBadge(f.is_active))}>
                      {f.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {f.requires_otp ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800 ring-1 ring-violet-100">
                        OTP
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="admin-table-scroll hidden md:block">
              <table className="admin-data-table min-w-[720px]">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '6.5rem' }} />
                  <col style={{ width: '6.5rem' }} />
                  <col style={{ width: '6.5rem' }} />
                  <col style={{ width: '5.5rem' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="col-num">Flat</th>
                    <th className="col-num">%</th>
                    <th className="col-num">Min</th>
                    <th className="col-num">Max</th>
                    <th className="col-badge">OTP</th>
                    <th className="col-badge">Upfront</th>
                    <th className="col-badge">Active</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f, i) => (
                    <tr
                      key={f.id}
                      className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
                    >
                      <td className="font-medium text-gray-900">{f.fee_type.replace(/_/g, ' ')}</td>
                      <td className="col-num">{formatDisplayCurrency(f.flat_amount)}</td>
                      <td className="col-num">{pctDisplay(f.percentage)}%</td>
                      <td className="col-num">{formatDisplayCurrency(f.min_amount)}</td>
                      <td className="col-num">{formatDisplayCurrency(f.max_amount)}</td>
                      <td className="col-badge">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset', yesNoBadge(f.requires_otp))}>
                          {f.requires_otp ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="col-badge">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset', yesNoBadge(f.charge_upfront !== false))}>
                          {f.charge_upfront !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="col-badge">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset', activeBadge(f.is_active))}>
                          {f.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="col-actions">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEditFee(f)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-primary-dark/20 hover:text-primary-dark"
                          >
                            <Pencil size={14} aria-hidden />
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
      </SectionPanel>

      {isSuperAdmin && (
        <SectionPanel
          title="Global compliance fee lines"
          action={
            <button type="button" onClick={() => openAddCompliance('global')} className={panelBtnClass()}>
              <Plus size={14} aria-hidden />
              Add line
            </button>
          }
        >
          {complianceQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : globalComplianceLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No global lines yet.</p>
          ) : (
            renderComplianceList(globalComplianceLines, false)
          )}
        </SectionPanel>
      )}

      <SectionPanel title="Compliance exemptions">
        <ComplianceExemptionPanel />
      </SectionPanel>

      <SectionPanel
        title="Per-customer compliance fee lines"
        action={
          <button
            type="button"
            onClick={() => openAddCompliance('user', userFilterId)}
            className={panelBtnClass()}
          >
            <Plus size={14} aria-hidden />
            Add line
          </button>
        }
      >
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-gray-600">
          Add extra compliance fees for specific customers. Customers in{' '}
          <span className="font-medium text-gray-800">Compliance exemptions</span> above never pay these — or any other
          compliance fees.
        </p>
        <div className="mb-4 max-w-md">
          <StyledSelect
            label="Filter by customer"
            value={userFilterId}
            onChange={(e) => setUserFilterId(e.target.value)}
          >
            <option value="">All customers with custom lines</option>
            {adminUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email}
              </option>
            ))}
          </StyledSelect>
        </div>
        {complianceQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filteredUserComplianceLines.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No per-customer lines yet.</p>
        ) : (
          renderComplianceList(filteredUserComplianceLines, true)
        )}
      </SectionPanel>

      <SectionPanel title="Exchange rates">
        {ratesError ? (
          <p className="text-sm text-red-600">Could not load exchange rates.</p>
        ) : ratesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rates.map((r) => (
              <div
                key={r.id}
                className="flex flex-col rounded-xl border border-gray-100 bg-gray-50/80 p-3 transition hover:border-primary-dark/15 hover:bg-white"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {r.from_currency}/{r.to_currency}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{parseFloat(r.rate).toFixed(4)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRate(r)
                    setRateDraft(r.rate)
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-dark hover:underline"
                >
                  <Pencil size={12} aria-hidden />
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>

      <AdminModal
        open={Boolean(editingFee)}
        onClose={() => setEditingFee(null)}
        title={editingFee ? `Edit ${editingFee.fee_type.replace(/_/g, ' ')}` : 'Edit fee'}
        footer={
          <AdminModalActions
            onCancel={() => setEditingFee(null)}
            primaryLabel="Save"
            primaryPending={updateFeeMutation.isPending}
            onPrimary={() =>
              editingFee &&
              updateFeeMutation.mutate({ id: editingFee.id, payload: buildFeePayload(false) })
            }
          />
        }
      >
        <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Flat amount</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.flat_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, flat_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Percentage (%)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.percentage_percent}
                  onChange={(e) => setFeeForm((s) => ({ ...s, percentage_percent: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Min fee</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.min_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, min_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Max fee (0 = no cap)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.max_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, max_amount: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.is_active}
                  onChange={(e) => setFeeForm((s) => ({ ...s, is_active: e.target.checked }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.requires_otp}
                  onChange={(e) => setFeeForm((s) => ({ ...s, requires_otp: e.target.checked }))}
                />
                Require email OTP before completing the transfer
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.charge_upfront}
                  onChange={(e) => setFeeForm((s) => ({ ...s, charge_upfront: e.target.checked }))}
                />
                Charge fee upfront (add to debit). If off, same-currency fee is deducted from recipient credit.
              </label>
        </div>
      </AdminModal>

      <AdminModal
        open={addingFee}
        onClose={() => setAddingFee(false)}
        title="Add transaction fee"
        description="Each fee type can only exist once. Use transfer types for bank-to-bank moves."
        footer={
          <AdminModalActions
            onCancel={() => setAddingFee(false)}
            primaryLabel="Create"
            primaryDisabled={!newFeeType}
            primaryPending={createFeeMutation.isPending}
            onPrimary={() => createFeeMutation.mutate(buildFeePayload(true))}
          />
        }
      >
        <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Fee type</label>
                <select
                  className="input-field mt-1 text-sm"
                  value={newFeeType}
                  onChange={(e) => setNewFeeType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {unusedFeeTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Flat amount</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.flat_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, flat_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Percentage (%)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.percentage_percent}
                  onChange={(e) => setFeeForm((s) => ({ ...s, percentage_percent: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Min fee</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.min_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, min_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Max fee (0 = no cap)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={feeForm.max_amount}
                  onChange={(e) => setFeeForm((s) => ({ ...s, max_amount: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.is_active}
                  onChange={(e) => setFeeForm((s) => ({ ...s, is_active: e.target.checked }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.requires_otp}
                  onChange={(e) => setFeeForm((s) => ({ ...s, requires_otp: e.target.checked }))}
                />
                Require email OTP before completing the transfer
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={feeForm.charge_upfront}
                  onChange={(e) => setFeeForm((s) => ({ ...s, charge_upfront: e.target.checked }))}
                />
                Charge fee upfront (add to debit). If off, same-currency fee is deducted from recipient credit.
              </label>
        </div>
      </AdminModal>

      <AdminModal
        open={Boolean(editingCompliance)}
        onClose={() => setEditingCompliance(null)}
        title="Edit fee line"
        description={editingCompliance?.name}
        footer={
          <AdminModalActions
            onCancel={() => setEditingCompliance(null)}
            primaryLabel="Save"
            primaryDisabled={!complianceForm.name.trim()}
            primaryPending={updateComplianceMutation.isPending}
            onPrimary={() =>
              editingCompliance &&
              updateComplianceMutation.mutate({ id: editingCompliance.id, payload: buildCompliancePayload() })
            }
          />
        }
      >
        <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Scope:{' '}
          <span className="font-medium">
            {complianceForm.scope === 'user' ? 'Per customer' : 'Global'}
          </span>
        </div>
        {renderComplianceFields({ codeOptional: false })}
      </AdminModal>

      <AdminModal
        open={addingCompliance}
        onClose={() => setAddingCompliance(false)}
        title="Add compliance fee line"
        description="Code must be unique per scope. Leave blank to generate from the display name."
        footer={
          <AdminModalActions
            onCancel={() => setAddingCompliance(false)}
            primaryLabel="Create"
            primaryDisabled={!complianceForm.name.trim()}
            primaryPending={createComplianceMutation.isPending}
            onPrimary={() => {
              if (!complianceForm.name.trim()) {
                toast.error('Enter a display name.')
                return
              }
              if (complianceForm.scope === 'user' && !complianceForm.user_id) {
                toast.error('Select the customer for this line.')
                return
              }
              createComplianceMutation.mutate(buildCompliancePayload())
            }}
          />
        }
      >
        {renderComplianceFields({ showScopePicker: true, codeOptional: true })}
      </AdminModal>

      <AdminModal
        open={Boolean(editingRate)}
        onClose={() => setEditingRate(null)}
        title={editingRate ? `Edit rate ${editingRate.from_currency}/${editingRate.to_currency}` : 'Edit rate'}
        size="md"
        footer={
          <AdminModalActions
            onCancel={() => setEditingRate(null)}
            primaryLabel="Save"
            primaryDisabled={!rateDraft}
            primaryPending={updateRateMutation.isPending}
            onPrimary={() => editingRate && updateRateMutation.mutate({ id: editingRate.id, rate: rateDraft })}
          />
        }
      >
        <label className="text-xs font-medium text-gray-700">Exchange rate</label>
        <input
          className="input-field mt-1 w-full text-sm"
          type="number"
          step="0.00000001"
          value={rateDraft}
          onChange={(e) => setRateDraft(e.target.value)}
        />
      </AdminModal>
    </div>
  )
}
