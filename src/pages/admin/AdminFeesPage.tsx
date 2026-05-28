import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/store/authStore'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { adminApiErrorMessage, decimalFieldOrZero } from '@/lib/adminApiErrors'
import { fromAdminListResponse } from '@/lib/adminList'
import { cn } from '@/utils/cn'

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
  const [complianceForm, setComplianceForm] = useState({
    scope: 'global' as 'global' | 'user',
    user_id: '',
    name: '',
    code: '',
    applies_to: 'INTERNATIONAL_TRANSFER',
    min_principal_threshold: '0',
    flat_amount: '0',
    percentage_percent: '0',
    min_amount: '0',
    max_amount: '0',
    is_active: true,
  })
  const [userFilterId, setUserFilterId] = useState('')

  const feesQuery = useQuery({ queryKey: ['admin-fees'], queryFn: () => adminApi.fees() })
  const ratesQuery = useQuery({ queryKey: ['admin-rates'], queryFn: () => adminApi.exchangeRates() })
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'compliance-picker'],
    queryFn: () => adminApi.users({ page_size: '200' }),
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
      toast.success('Fee line created. Open pending sessions will include this fee.')
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
        `Delete compliance fee line "${row.name}"? This cannot be undone. Lines used in past sessions cannot be deleted — deactivate instead.`,
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

  const buildCompliancePayload = () => {
    const code = slugifyCode(complianceForm.code, complianceForm.name)
    const user =
      complianceForm.scope === 'user' && complianceForm.user_id ? complianceForm.user_id : null
    return {
      name: complianceForm.name.trim(),
      code,
      user,
      applies_to: complianceForm.applies_to,
      min_principal_threshold: decimalFieldOrZero(complianceForm.min_principal_threshold),
      flat_amount: decimalFieldOrZero(complianceForm.flat_amount),
      percentage: pctToDecimal(complianceForm.percentage_percent),
      min_amount: decimalFieldOrZero(complianceForm.min_amount),
      max_amount: decimalFieldOrZero(complianceForm.max_amount),
      is_active: complianceForm.is_active,
    } as Record<string, unknown>
  }

  const openEditCompliance = (row: ComplianceFeeLineRow) => {
    setEditingCompliance(row)
    setComplianceForm({
      scope: row.user ? 'user' : 'global',
      user_id: row.user ?? '',
      name: row.name,
      code: row.code,
      applies_to: row.applies_to,
      min_principal_threshold: row.min_principal_threshold,
            flat_amount: row.flat_amount,
      percentage_percent: pctDisplay(row.percentage),
      min_amount: row.min_amount,
      max_amount: row.max_amount,
      is_active: row.is_active,
    })
  }

  const openAddCompliance = (scope: 'global' | 'user' = 'user', presetUserId = '') => {
    const effectiveScope = isSuperAdmin ? scope : 'user'
    setAddingCompliance(true)
    setComplianceForm({
      scope: effectiveScope,
      user_id: presetUserId,
      name: '',
      code: '',
      applies_to: 'INTERNATIONAL_TRANSFER',
      min_principal_threshold: '0',
      flat_amount: '0',
      percentage_percent: '0',
      min_amount: '0',
      max_amount: '0',
      is_active: true,
    })
  }

  const renderComplianceTable = (rows: ComplianceFeeLineRow[], showUserColumn: boolean) => (
    <div className="admin-table-scroll">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2.5 sm:px-6">Name</th>
            <th className="px-3 py-2.5">Code</th>
            {showUserColumn ? <th className="px-3 py-2.5">Customer</th> : null}
            <th className="px-3 py-2.5">Applies</th>
            <th className="px-3 py-2.5">Min principal</th>
            <th className="px-3 py-2.5">Pricing</th>
            <th className="px-3 py-2.5">Active</th>
            <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
            >
              <td className="px-4 py-3 font-medium text-gray-900 sm:px-6">{row.name}</td>
              <td className="px-3 py-3 font-mono text-xs text-gray-600">{row.code}</td>
              {showUserColumn ? (
                <td className="max-w-[11rem] px-3 py-3">
                  {row.user_email ? (
                    <>
                      <p className="truncate text-xs font-medium text-gray-800" title={row.user_email}>
                        {row.user_email}
                      </p>
                      {row.user_full_name ? (
                        <p className="truncate text-[10px] text-gray-500" title={row.user_full_name}>
                          {row.user_full_name}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              ) : null}
              <td className="px-3 py-3 text-xs text-gray-700">{appliesLabel(row.applies_to)}</td>
              <td className="px-3 py-3 tabular-nums text-gray-800">
                {formatDisplayCurrency(row.min_principal_threshold)}
              </td>
              <td className="max-w-[280px] px-3 py-3 text-xs text-gray-600">
                {formatDisplayCurrency(row.flat_amount)} flat + {pctDisplay(row.percentage)}% · min{' '}
                {formatDisplayCurrency(row.min_amount)}
                {parseFloat(row.max_amount) > 0 ? ` · max ${formatDisplayCurrency(row.max_amount)}` : ''}
              </td>
              <td className="px-3 py-3">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
                    activeBadge(row.is_active),
                  )}
                >
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 sm:px-6">
                <div className="flex items-center justify-end gap-1">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <div className="admin-table-scroll">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5 sm:px-6">Type</th>
                  <th className="px-3 py-2.5">Flat</th>
                  <th className="px-3 py-2.5">%</th>
                  <th className="px-3 py-2.5">Min</th>
                  <th className="px-3 py-2.5">Max</th>
                  <th className="px-3 py-2.5">OTP</th>
                  <th className="px-3 py-2.5">Upfront</th>
                  <th className="px-3 py-2.5">Active</th>
                  <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fees.map((f, i) => (
                  <tr
                    key={f.id}
                    className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 sm:px-6">
                      {f.fee_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatDisplayCurrency(f.flat_amount)}</td>
                    <td className="px-3 py-3 tabular-nums">{pctDisplay(f.percentage)}%</td>
                    <td className="px-3 py-3 tabular-nums">{formatDisplayCurrency(f.min_amount)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatDisplayCurrency(f.max_amount)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
                          yesNoBadge(f.requires_otp),
                        )}
                      >
                        {f.requires_otp ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
                          yesNoBadge(f.charge_upfront !== false),
                        )}
                      >
                        {f.charge_upfront !== false ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset',
                          activeBadge(f.is_active),
                        )}
                      >
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEditFee(f)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-primary-dark/20 hover:text-primary-dark"
                      >
                        <Pencil size={14} aria-hidden />
                        <span className="sr-only">Edit {f.fee_type}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            renderComplianceTable(globalComplianceLines, false)
          )}
        </SectionPanel>
      )}

      <SectionPanel
        title="Per-user compliance fee lines"
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
        <div className="mb-4 max-w-md">
          <StyledSelect
            label="Customer"
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
          <p className="py-6 text-center text-sm text-gray-500">No per-user lines yet.</p>
        ) : (
          renderComplianceTable(filteredUserComplianceLines, true)
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

      {editingFee && (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="card max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,28rem)] overflow-y-auto p-4 shadow-xl sm:p-6">
            <h3 className="font-semibold text-gray-900">Edit {editingFee.fee_type.replace(/_/g, ' ')}</h3>
            <div className="mt-4 space-y-3">
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
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" onClick={() => setEditingFee(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={updateFeeMutation.isPending}
                onClick={() =>
                  updateFeeMutation.mutate({
                    id: editingFee.id,
                    payload: buildFeePayload(false),
                  })
                }
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addingFee && (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="card max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,28rem)] overflow-y-auto p-4 shadow-xl sm:p-6">
            <h3 className="font-semibold text-gray-900">Add transaction fee</h3>
            <p className="mt-1 text-xs text-gray-500">Each fee type can only exist once. Use transfer types for bank-to-bank moves.</p>
            <div className="mt-4 space-y-3">
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
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" onClick={() => setAddingFee(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={createFeeMutation.isPending || !newFeeType}
                onClick={() => createFeeMutation.mutate(buildFeePayload(true))}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCompliance && (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="card max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,28rem)] overflow-y-auto p-4 shadow-xl sm:p-6">
            <h3 className="font-semibold text-gray-900">Edit fee line</h3>
            <p className="mt-1 text-xs text-gray-500">{editingCompliance.name}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Scope</label>
                <p className="mt-1 text-sm text-gray-800">
                  {complianceForm.scope === 'user' ? 'Per-user (replaces global for that customer)' : 'Global'}
                </p>
              </div>
              {complianceForm.scope === 'user' ? (
                <div>
                  <label className="text-xs font-medium text-gray-700">Customer</label>
                  <select
                    className="input-field mt-1 text-sm"
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
                  className="input-field mt-1 text-sm"
                  value={complianceForm.name}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Code (slug, unique per scope)</label>
                <input
                  className="input-field mt-1 font-mono text-sm"
                  value={complianceForm.code}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Applies to</label>
                <select
                  className="input-field mt-1 text-sm"
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
              <div>
                <label className="text-xs font-medium text-gray-700">Min principal threshold (0 = always)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={complianceForm.min_principal_threshold}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, min_principal_threshold: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Flat amount</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={complianceForm.flat_amount}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, flat_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Percentage (% of principal)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={complianceForm.percentage_percent}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, percentage_percent: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Min fee</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={complianceForm.min_amount}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, min_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Max fee (0 = no cap)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  step="0.01"
                  value={complianceForm.max_amount}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, max_amount: e.target.value }))}
                />
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
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" onClick={() => setEditingCompliance(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={updateComplianceMutation.isPending || !complianceForm.name.trim()}
                onClick={() =>
                  editingCompliance &&
                  updateComplianceMutation.mutate({ id: editingCompliance.id, payload: buildCompliancePayload() })
                }
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addingCompliance && (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="card max-h-[min(92dvh,90vh)] w-full max-w-[min(100%,28rem)] overflow-y-auto p-4 shadow-xl sm:p-6">
            <h3 className="font-semibold text-gray-900">Add compliance fee line</h3>
            <p className="mt-1 text-xs text-gray-500">
              Code must be unique within global lines or within the chosen customer. Leave code blank to generate from the name.
            </p>
            <div className="mt-4 space-y-3">
              {isSuperAdmin ? (
                <div>
                  <label className="text-xs font-medium text-gray-700">Scope</label>
                  <select
                    className="input-field mt-1 text-sm"
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
                    <option value="user">Per customer (overrides global)</option>
                  </select>
                </div>
              ) : null}
              {complianceForm.scope === 'user' ? (
                <div>
                  <label className="text-xs font-medium text-gray-700">Customer</label>
                  <select
                    className="input-field mt-1 text-sm"
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
                  className="input-field mt-1 text-sm"
                  value={complianceForm.name}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Insurance fee"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Code (optional)</label>
                <input
                  className="input-field mt-1 font-mono text-sm"
                  value={complianceForm.code}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, code: e.target.value }))}
                  placeholder="insurance-fee"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Applies to</label>
                <select
                  className="input-field mt-1 text-sm"
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
              <div>
                <label className="text-xs font-medium text-gray-700">Min principal threshold (0 = always)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={complianceForm.min_principal_threshold}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, min_principal_threshold: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Flat amount</label>
                <input
                  className="input-field mt-1 text-sm"
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
                  className="input-field mt-1 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={complianceForm.percentage_percent}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, percentage_percent: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Min fee</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={complianceForm.min_amount}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, min_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Max fee (0 = no cap)</label>
                <input
                  className="input-field mt-1 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={complianceForm.max_amount}
                  onChange={(e) => setComplianceForm((s) => ({ ...s, max_amount: e.target.value }))}
                />
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
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" onClick={() => setAddingCompliance(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={createComplianceMutation.isPending || !complianceForm.name.trim()}
                onClick={() => {
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
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRate && (
        <div className="admin-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="card w-full max-w-[min(100%,24rem)] p-4 shadow-xl sm:p-6">
            <h3 className="font-semibold text-gray-900">
              Edit rate {editingRate.from_currency}/{editingRate.to_currency}
            </h3>
            <input
              className="input-field mt-3 text-sm"
              type="number"
              step="0.00000001"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" onClick={() => setEditingRate(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={updateRateMutation.isPending || !rateDraft}
                onClick={() => updateRateMutation.mutate({ id: editingRate.id, rate: rateDraft })}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
