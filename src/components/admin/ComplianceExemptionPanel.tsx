import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { adminApiErrorMessage } from '@/lib/adminApiErrors'
import { fromAdminListResponse } from '@/lib/adminList'
import { cn } from '@/utils/cn'

type CustomerRow = {
  id: string
  full_name: string
  email: string
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ComplianceExemptionPanel() {
  const queryClient = useQueryClient()
  const [addCustomerId, setAddCustomerId] = useState('')
  const [addSearch, setAddSearch] = useState('')

  const customersQuery = useQuery({
    queryKey: ['admin-users', 'compliance-exemption-customers'],
    queryFn: () => adminApi.users({ role: 'CUSTOMER', page_size: '500' }),
  })

  const exemptQuery = useQuery({
    queryKey: ['admin-users', 'compliance-exempt'],
    queryFn: () => adminApi.users({ role: 'CUSTOMER', compliance_fees_exempt: 'true', page_size: '500' }),
  })

  const allCustomers = fromAdminListResponse<CustomerRow>(customersQuery.data)
  const exemptCustomers = fromAdminListResponse<CustomerRow>(exemptQuery.data)
  const exemptIds = useMemo(() => new Set(exemptCustomers.map((c) => c.id)), [exemptCustomers])

  const eligibleToAdd = useMemo(() => {
    const q = addSearch.trim().toLowerCase()
    return allCustomers
      .filter((c) => !exemptIds.has(c.id))
      .filter((c) => {
        if (!q) return true
        return c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      })
  }, [allCustomers, exemptIds, addSearch])

  const toggleMutation = useMutation({
    mutationFn: ({ userId, exempt }: { userId: string; exempt: boolean }) =>
      adminApi.updateUser(userId, { compliance_fees_exempt: exempt }),
    onSuccess: (_res, { exempt }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(exempt ? 'Customer is now exempt from compliance fees.' : 'Exemption removed.')
    },
    onError: (err: unknown) => toast.error(adminApiErrorMessage(err, 'Could not update exemption.')),
  })

  const loading = customersQuery.isLoading || exemptQuery.isLoading

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm leading-relaxed text-sky-950">
        <p className="font-medium">What this does</p>
        <p className="mt-1 text-sky-900/85">
          Exempt customers complete <strong>international transfers</strong> and <strong>loan payouts</strong> with no
          compliance payment or verification. This overrides global and per-customer fee lines.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary-dark" aria-hidden />
          <p className="text-sm font-semibold text-gray-900">Grant exemption</p>
        </div>
        <p className="mt-1 text-xs text-gray-500">Choose a customer who should skip all compliance fees.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <input
              type="search"
              className="input-field w-full text-sm"
              placeholder="Search by name or email…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
            />
            <StyledSelect
              label="Customer"
              value={addCustomerId}
              onChange={(e) => setAddCustomerId(e.target.value)}
              disabled={customersQuery.isLoading}
            >
              <option value="">
                {eligibleToAdd.length === 0 ? 'No matching customers' : 'Select customer…'}
              </option>
              {eligibleToAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} — {u.email}
                </option>
              ))}
            </StyledSelect>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={!addCustomerId || toggleMutation.isPending}
            onClick={() => {
              toggleMutation.mutate(
                { userId: addCustomerId, exempt: true },
                {
                  onSuccess: () => {
                    setAddCustomerId('')
                    setAddSearch('')
                  },
                },
              )
            }}
          >
            Grant exemption
          </button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Exempt customers</p>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              exemptCustomers.length > 0
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
            )}
          >
            {exemptCustomers.length} exempt
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : exemptCustomers.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-10 text-center">
            <ShieldOff size={28} className="text-gray-300" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm font-medium text-gray-700">No exemptions yet</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
              All customers follow your global and per-customer compliance fee lines until you grant an exemption
              above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {exemptCustomers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100"
                  aria-hidden
                >
                  {initials(u.full_name) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{u.full_name}</p>
                  <p className="truncate text-xs text-gray-500">{u.email}</p>
                </div>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100 sm:inline-flex">
                  <ShieldCheck size={11} aria-hidden />
                  Exempt
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ userId: u.id, exempt: false })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
