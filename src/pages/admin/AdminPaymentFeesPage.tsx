import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Banknote, Trash2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { StyledSelect } from '@/components/forms/StyledSelect'
import Spinner from '@/components/ui/Spinner'
import { formatDisplayCurrency } from '@/utils/format'
import { getAllBillerKeys } from '@/lib/uaeBillPayCatalog'
import { cn } from '@/utils/cn'
import { fromAdminListResponse } from '@/lib/adminList'

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {children}
    </label>
  )
}

function SectionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-4 py-3 sm:px-6">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export default function AdminPaymentFeesPage() {
  const queryClient = useQueryClient()
  const billerOptions = useMemo(() => getAllBillerKeys(), [])
  const [selectedKey, setSelectedKey] = useState('')
  const [overrideAmount, setOverrideAmount] = useState('1.25')
  const [billerLabel, setBillerLabel] = useState('')
  const [defaultDraft, setDefaultDraft] = useState('')

  const { data: settingsRes, isLoading: settingsLoading, isError: settingsErr } = useQuery({
    queryKey: ['admin-payment-fee-settings'],
    queryFn: () => adminApi.paymentFeeSettings(),
  })
  const { data: overridesRes, isLoading: overridesLoading, isError: overridesErr } = useQuery({
    queryKey: ['admin-payment-fee-overrides'],
    queryFn: () => adminApi.paymentFeeOverrides(),
  })

  const settings = settingsRes?.data as { default_management_fee?: string } | undefined
  const overrides = fromAdminListResponse<{
    id: string
    service_id: string
    biller_id: string
    biller_label?: string
    management_fee: string
  }>(overridesRes)

  useEffect(() => {
    if (settings?.default_management_fee != null) {
      setDefaultDraft(String(settings.default_management_fee))
    }
  }, [settings?.default_management_fee])

  const selectedParts = useMemo(() => {
    const opt = billerOptions.find((o) => `${o.service_id}:${o.biller_id}` === selectedKey)
    return opt ? { service_id: opt.service_id, biller_id: opt.biller_id } : null
  }, [billerOptions, selectedKey])

  const updateSettingsMutation = useMutation({
    mutationFn: () => adminApi.updatePaymentFeeSettings({ default_management_fee: defaultDraft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-fee-settings'] })
      toast.success('Default management fee updated.')
    },
    onError: () => toast.error('Could not update default fee.'),
  })

  const upsertMutation = useMutation({
    mutationFn: () => {
      if (!selectedParts) throw new Error('Select a biller')
      return adminApi.upsertPaymentFeeOverride({
        service_id: selectedParts.service_id,
        biller_id: selectedParts.biller_id,
        management_fee: overrideAmount,
        biller_label: billerLabel || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-fee-overrides'] })
      toast.success('Override saved.')
    },
    onError: () => toast.error('Could not save override.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePaymentFeeOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-fee-overrides'] })
      toast.success('Override removed.')
    },
    onError: () => toast.error('Could not delete override.'),
  })

  return (
    <div className="admin-page mx-auto max-w-4xl space-y-6 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
            <Banknote size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">Bill payment fees</h1>
            <p className="text-xs text-gray-500">Default fee and per-biller overrides</p>
          </div>
        </div>
        {!overridesLoading && overrides.length > 0 ? (
          <p className="text-xs font-semibold tabular-nums text-gray-500">
            {overrides.length} {overrides.length === 1 ? 'override' : 'overrides'}
          </p>
        ) : null}
      </section>

      {(settingsErr || overridesErr) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load bill-pay fee data. Ensure you are logged in as staff and the API is running.
        </div>
      )}

      <SectionPanel title="Default fee">
        {settingsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <FieldLabel>Amount (USD)</FieldLabel>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full max-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium tabular-nums text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                value={defaultDraft}
                onChange={(e) => setDefaultDraft(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={updateSettingsMutation.isPending || !defaultDraft}
              onClick={() => updateSettingsMutation.mutate()}
              className="inline-flex items-center rounded-lg bg-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-light disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Per-biller override">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <StyledSelect
              label="Biller"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              <option value="">Select service and biller</option>
              {billerOptions.map((o) => (
                <option key={`${o.service_id}:${o.biller_id}`} value={`${o.service_id}:${o.biller_id}`}>
                  {o.label}
                </option>
              ))}
            </StyledSelect>
          </div>
          <div>
            <FieldLabel>Management fee (USD)</FieldLabel>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium tabular-nums text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              value={overrideAmount}
              onChange={(e) => setOverrideAmount(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Admin label (optional)</FieldLabel>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Internal note"
              value={billerLabel}
              onChange={(e) => setBillerLabel(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={upsertMutation.isPending || !selectedParts}
          onClick={() => upsertMutation.mutate()}
          className="mt-4 inline-flex items-center rounded-lg bg-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-light disabled:opacity-50"
        >
          {upsertMutation.isPending ? 'Saving…' : 'Save override'}
        </button>
      </SectionPanel>

      <SectionPanel title="Active overrides">
        {overridesLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : overrides.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No overrides — default fee applies.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5 sm:px-6">Service</th>
                  <th className="px-3 py-2.5">Biller</th>
                  <th className="px-3 py-2.5">Fee</th>
                  <th className="px-4 py-2.5 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overrides.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn('transition-colors hover:bg-emerald-50/25', i % 2 === 1 && 'bg-gray-50/40')}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 sm:px-6">{row.service_id}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-gray-800">{row.biller_id}</span>
                      {row.biller_label ? (
                        <p className="mt-0.5 text-[10px] text-gray-500">{row.biller_label}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-gray-900">
                      {formatDisplayCurrency(row.management_fee)}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <button
                        type="button"
                        title="Remove override"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(row.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={14} aria-hidden />
                        <span className="sr-only">Remove {row.service_id}/{row.biller_id}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  )
}
