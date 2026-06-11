import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Download, FileText, Mail } from 'lucide-react'
import { adminApi } from '@/api/admin'
import AdminUserCombobox from '@/components/admin/AdminUserCombobox'
import { cn } from '@/utils/cn'

function triggerPdfDownload(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'SafaPay_Project_Loan_Application.pdf'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function LoanApplicationFormPanel() {
  const [email, setEmail] = useState('')
  const [customerId, setCustomerId] = useState('')
  const emailOverride = email.trim().length > 0

  const downloadMutation = useMutation({
    mutationFn: () =>
      adminApi.downloadLoanApplicationForm(emailOverride ? undefined : customerId || undefined),
    onSuccess: (response) => {
      triggerPdfDownload(response.data as Blob)
      toast.success('PDF downloaded.')
    },
    onError: () => toast.error('Could not download the application form.'),
  })

  const sendMutation = useMutation({
    mutationFn: () =>
      adminApi.sendLoanApplicationForm({
        email: emailOverride ? email.trim() : undefined,
        user_id: emailOverride ? undefined : customerId || undefined,
      }),
    onSuccess: (_data, variables) => {
      toast.success('Application form emailed.')
      if (variables.email) setEmail('')
      else setCustomerId('')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Could not send the application form.')
    },
  })

  const canSend = emailOverride || Boolean(customerId)
  const busy = downloadMutation.isPending || sendMutation.isPending

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-10px_rgba(21,42,30,0.1)]">
      <div className="h-1 bg-gradient-to-r from-primary-dark via-primary-dark/80 to-accent/80" aria-hidden />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-accent shadow-sm ring-4 ring-primary-dark/10">
              <FileText size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Project loan application form</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500">
                7-page SafaPay PDF (cover, application details, loan request, financials, bank details,
                declaration, and official-use checklist). Send to a customer or any email address.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">
              Recipient email <span className="font-normal text-gray-400">(optional)</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-field h-11 w-full text-sm"
              autoComplete="off"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              If you enter an email here, the form is sent to that address and customer selection is skipped.
            </span>
          </label>

          <div className={cn(emailOverride && 'pointer-events-none opacity-45')}>
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">
              Customer {emailOverride ? <span className="font-normal text-gray-400">(not used)</span> : null}
            </span>
            <AdminUserCombobox
              value={customerId}
              onChange={setCustomerId}
              placeholder="Search customer…"
              className="w-full"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Prefills name, contact, and address on the PDF when no override email is set.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => downloadMutation.mutate()}
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-primary-dark/20 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={16} aria-hidden />
            Download PDF
          </button>
          <button
            type="button"
            disabled={!canSend || busy}
            onClick={() => sendMutation.mutate()}
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary disabled:opacity-50"
          >
            <Mail size={16} aria-hidden />
            Email PDF
          </button>
        </div>
      </div>
    </section>
  )
}
