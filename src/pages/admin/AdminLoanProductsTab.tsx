import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { AdminMobileCard } from '@/components/admin/AdminResponsiveList'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency, formatPercentage } from '@/utils/format'
import { LOAN_TYPE_DISPLAY_NAMES, type LoanCatalogType } from '@/lib/loanProductVisuals'

export type AdminLoanProduct = {
  id: string
  name: string
  loan_type: string
  interest_rate: string
  min_amount: string
  max_amount: string
  min_term_months: number
  max_term_months: number
  description: string
  tagline: string
  full_description: string
  hero_image_url: string | null
  is_active: boolean
  application_count?: number
}

const LOAN_TYPES = Object.entries(LOAN_TYPE_DISPLAY_NAMES) as [LoanCatalogType, string][]

const emptyForm = () => ({
  name: '',
  loan_type: 'PERSONAL' as LoanCatalogType,
  interest_rate_percent: '12',
  min_amount: '1000',
  max_amount: '50000',
  min_term_months: '6',
  max_term_months: '60',
  description: '',
  tagline: '',
  full_description: '',
  is_active: true,
})

function productToForm(p: AdminLoanProduct) {
  const rate = parseFloat(p.interest_rate)
  return {
    name: p.name,
    loan_type: p.loan_type as LoanCatalogType,
    interest_rate_percent: Number.isFinite(rate) ? String(rate * 100) : '0',
    min_amount: p.min_amount,
    max_amount: p.max_amount,
    min_term_months: String(p.min_term_months),
    max_term_months: String(p.max_term_months),
    description: p.description ?? '',
    tagline: p.tagline ?? '',
    full_description: p.full_description ?? '',
    is_active: p.is_active,
  }
}

function buildFormData(
  form: ReturnType<typeof emptyForm>,
  imageFile: File | null,
  clearImage: boolean,
) {
  const fd = new FormData()
  fd.append('name', form.name.trim())
  fd.append('loan_type', form.loan_type)
  fd.append('interest_rate', String(parseFloat(form.interest_rate_percent) / 100))
  fd.append('min_amount', form.min_amount)
  fd.append('max_amount', form.max_amount)
  fd.append('min_term_months', form.min_term_months)
  fd.append('max_term_months', form.max_term_months)
  fd.append('description', form.description)
  fd.append('tagline', form.tagline)
  fd.append('full_description', form.full_description)
  fd.append('is_active', form.is_active ? 'true' : 'false')
  if (imageFile) fd.append('hero_image', imageFile)
  if (clearImage) fd.append('clear_hero_image', 'true')
  return fd
}

export default function AdminLoanProductsTab() {
  const queryClient = useQueryClient()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<AdminLoanProduct | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [clearImage, setClearImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-loan-products'],
    queryFn: adminApi.loanProducts,
  })
  const raw = data?.data as { results?: AdminLoanProduct[] } | AdminLoanProduct[] | undefined
  const products: AdminLoanProduct[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : []

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(editing?.hero_image_url ?? null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile, editing?.hero_image_url])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-loan-products'] })
    void queryClient.invalidateQueries({ queryKey: ['loan-products'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = buildFormData(form, imageFile, clearImage && Boolean(editing))
      if (editing) return adminApi.updateLoanProduct(editing.id, fd)
      return adminApi.createLoanProduct(fd)
    },
    onSuccess: () => {
      invalidate()
      toast.success(editing ? 'Loan product updated.' : 'Loan product created.')
      closeEditor()
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: unknown } })?.response?.data
      const msg =
        typeof d === 'object' && d && 'detail' in d
          ? String((d as { detail: string }).detail)
          : 'Could not save loan product.'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteLoanProduct(id),
    onSuccess: () => {
      invalidate()
      toast.success('Loan product deleted.')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof d === 'string' ? d : 'Could not delete.')
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setImageFile(null)
    setClearImage(false)
    setEditorOpen(true)
  }

  const openEdit = (p: AdminLoanProduct) => {
    setEditing(p)
    setForm(productToForm(p))
    setImageFile(null)
    setClearImage(false)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditing(null)
    setImageFile(null)
    setClearImage(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="hidden text-xs text-gray-500 sm:block">
          Rates, limits, images, and copy shown on the customer Loans page.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-dark px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-light sm:w-auto"
        >
          <Plus size={14} aria-hidden /> Add product
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No loan products yet.</p>
      ) : (
        <>
          <ul className="space-y-3 p-3 md:hidden sm:p-4">
            {products.map((p) => (
              <AdminMobileCard
                key={p.id}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-0 shadow-[0_2px_16px_-6px_rgba(21,42,30,0.1)]"
              >
                <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
                <div className="p-4">
                  <div className="flex gap-3">
                    {p.hero_image_url ? (
                      <img src={p.hero_image_url} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[10px] text-gray-400">
                        No img
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-gray-900">{p.name}</p>
                        <span className={cn('badge shrink-0 text-[10px]', p.is_active ? 'badge-success' : 'badge-neutral')}>
                          {p.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{p.loan_type.replace(/_/g, ' ')}</p>
                      <p className="mt-2 text-sm font-bold tabular-nums text-gray-900">
                        {formatPercentage(p.interest_rate)} APR
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount</p>
                      <p className="mt-0.5 tabular-nums">
                        {formatDisplayCurrency(p.min_amount)} – {formatDisplayCurrency(p.max_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Term</p>
                      <p className="mt-0.5 tabular-nums">
                        {p.min_term_months}–{p.max_term_months} mo
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-primary-dark shadow-sm transition hover:bg-gray-50"
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending || (p.application_count ?? 0) > 0}
                      title={
                        (p.application_count ?? 0) > 0 ? 'Cannot delete — applications exist' : 'Delete product'
                      }
                      onClick={() => {
                        if (window.confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id)
                      }}
                      className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border border-red-200/90 bg-red-50/80 px-2.5 py-2 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-40"
                    >
                      <Trash2 size={14} aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>
              </AdminMobileCard>
            ))}
          </ul>

          <div className="admin-table-scroll hidden md:block">
            <table className="admin-data-table min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200/80 bg-gray-50 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 pb-3 pr-3 pt-3 sm:px-6">Product</th>
                  <th className="pb-3 pr-3 pt-3">Type</th>
                  <th className="pb-3 pr-3 pt-3">Rate</th>
                  <th className="pb-3 pr-3 pt-3">Amount range</th>
                  <th className="pb-3 pr-3 pt-3">Term</th>
                  <th className="pb-3 pr-3 pt-3">Status</th>
                  <th className="pb-3 pt-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 align-middle hover:bg-gray-50/80">
                    <td className="px-4 py-3 pr-3 sm:px-6">
                      <div className="flex items-center gap-3">
                        {p.hero_image_url ? (
                          <img src={p.hero_image_url} alt="" className="h-10 w-14 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">
                            No img
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">{p.loan_type.replace(/_/g, ' ')}</td>
                    <td className="py-3 pr-3 tabular-nums">{formatPercentage(p.interest_rate)}</td>
                    <td className="py-3 pr-3 text-xs text-gray-600">
                      {formatDisplayCurrency(p.min_amount)} – {formatDisplayCurrency(p.max_amount)}
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {p.min_term_months}–{p.max_term_months} mo
                    </td>
                    <td className="py-3 pr-3">
                      <span className={cn('badge text-[10px]', p.is_active ? 'badge-success' : 'badge-neutral')}>
                        {p.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-dark hover:underline"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={deleteMutation.isPending || (p.application_count ?? 0) > 0}
                          title={
                            (p.application_count ?? 0) > 0
                              ? 'Cannot delete — applications exist'
                              : 'Delete product'
                          }
                          onClick={() => {
                            if (window.confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id)
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                        >
                          <Trash2 size={14} /> Delete
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

      {editorOpen ? (
        <div className="admin-modal-backdrop fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="card my-0 w-full max-w-[min(100%,42rem)] max-h-[min(92dvh,800px)] overflow-y-auto rounded-t-2xl p-4 sm:my-8 sm:rounded-2xl sm:p-6">
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit loan product' : 'New loan product'}</h2>
            <p className="mt-1 text-xs text-gray-500">
              Fields match the customer Loans catalog: hero image, tagline, rates, limits, and full description.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase text-gray-400">Name</span>
                  <input
                    className="input-field mt-1 text-sm"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Category</span>
                  <select
                    className="input-field mt-1 text-sm"
                    value={form.loan_type}
                    onChange={(e) => setForm((f) => ({ ...f, loan_type: e.target.value as LoanCatalogType }))}
                  >
                    {LOAN_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Interest rate (%)</span>
                  <input
                    className="input-field mt-1 text-sm"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.interest_rate_percent}
                    onChange={(e) => setForm((f) => ({ ...f, interest_rate_percent: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Min amount</span>
                  <input
                    className="input-field mt-1 text-sm"
                    type="number"
                    min="0"
                    required
                    value={form.min_amount}
                    onChange={(e) => setForm((f) => ({ ...f, min_amount: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Max amount</span>
                  <input
                    className="input-field mt-1 text-sm"
                    type="number"
                    min="0"
                    required
                    value={form.max_amount}
                    onChange={(e) => setForm((f) => ({ ...f, max_amount: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Min term (months)</span>
                  <input
                    className="input-field mt-1 text-sm"
                    type="number"
                    min="1"
                    required
                    value={form.min_term_months}
                    onChange={(e) => setForm((f) => ({ ...f, min_term_months: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-400">Max term (months)</span>
                  <input
                    className="input-field mt-1 text-sm"
                    type="number"
                    min="1"
                    required
                    value={form.max_term_months}
                    onChange={(e) => setForm((f) => ({ ...f, max_term_months: e.target.value }))}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-400">Card summary</span>
                <textarea
                  className="input-field mt-1 min-h-[4rem] text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short text on the loan card"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-400">Tagline</span>
                <input
                  className="input-field mt-1 text-sm"
                  value={form.tagline}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  placeholder="Shown under the title in the detail modal"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-gray-400">Full description</span>
                <textarea
                  className="input-field mt-1 min-h-[8rem] text-sm"
                  value={form.full_description}
                  onChange={(e) => setForm((f) => ({ ...f, full_description: e.target.value }))}
                  placeholder="Paragraphs in the detail modal (separate paragraphs with blank lines)"
                />
              </label>

              <div>
                <span className="text-xs font-semibold uppercase text-gray-400">Hero image</span>
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="mt-2 aspect-[16/10] w-full max-w-xs rounded-xl object-cover" />
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm text-gray-600"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setImageFile(f ?? null)
                    setClearImage(false)
                  }}
                />
                {editing?.hero_image_url ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-red-600 hover:underline"
                    onClick={() => {
                      setImageFile(null)
                      setClearImage(true)
                      setPreviewUrl(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    Remove current image
                  </button>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Visible to customers
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row">
                <button type="button" className="btn-outline flex-1 py-2.5 text-sm" onClick={closeEditor}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm font-semibold"
                >
                  {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
