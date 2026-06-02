import { useCallback, useMemo, useRef } from 'react'
import { CheckCircle2, Download, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import TransactionReceiptDocument from '@/components/transactions/TransactionReceiptDocument'
import ReceiptFormatMenu from '@/components/transactions/ReceiptFormatMenu'
import {
  buildReceiptSnapshot,
  downloadReceiptFromCanvas,
  receiptFilename,
  renderReceiptCanvas,
  shareReceiptFromCanvas,
  type ReceiptFormat,
} from '@/lib/transactionReceiptExport'
import { useAuthStore } from '@/store/authStore'
import type { TransactionListItem } from '@/utils/transactionDisplay'
import { canExportTransactionReceipt } from '@/utils/transactionDisplay'

type Props = {
  transaction: TransactionListItem
  uetr?: string | null
  demoNote?: string | null
  onDashboard: () => void
  onAnother: () => void
}

export default function TransferSuccessReceipt({
  transaction,
  uetr,
  demoNote,
  onDashboard,
  onAnother,
}: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const showReceipt = canExportTransactionReceipt(transaction, false)

  const receiptSnapshot = useMemo(() => {
    if (!showReceipt) return null
    const senderName = (user?.full_name || user?.email || 'Account holder').trim()
    return buildReceiptSnapshot(transaction, { senderName })
  }, [transaction, showReceipt, user?.full_name, user?.email])

  const captureReceipt = useCallback(async () => {
    if (!receiptRef.current) throw new Error('Receipt template not ready.')
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    return renderReceiptCanvas(receiptRef.current)
  }, [])

  const exportReceipt = useCallback(
    async (format: ReceiptFormat, mode: 'download' | 'share') => {
      if (!receiptSnapshot) return
      try {
        const canvas = await captureReceipt()
        const filename = receiptFilename(receiptSnapshot.reference, format)
        const title = `Transaction ${receiptSnapshot.reference}`

        if (mode === 'download') {
          await downloadReceiptFromCanvas(canvas, format, filename)
          toast.success(format === 'pdf' ? 'Receipt PDF downloaded.' : 'Receipt image downloaded.')
          return
        }

        const result = await shareReceiptFromCanvas(canvas, format, filename, title)
        if (result === 'shared') {
          toast.success('Receipt shared.')
        } else if (result === 'cancelled') {
          toast('Share cancelled.')
        } else {
          toast.success(
            format === 'pdf'
              ? 'Sharing unavailable — PDF downloaded instead.'
              : 'Sharing unavailable — image downloaded instead.',
          )
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not export receipt.')
      }
    },
    [receiptSnapshot, captureReceipt],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
      <div className="bg-gradient-to-br from-primary-dark to-emerald-900 px-6 py-8 text-center text-white sm:px-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
          <CheckCircle2 className="h-8 w-8 text-accent" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-xl font-semibold sm:text-2xl">Transfer sent</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/75">
          Your transfer was processed successfully. Save or share your receipt below.
        </p>
        {transaction.reference_number ? (
          <p className="mx-auto mt-3 text-xs text-white/70">
            Reference{' '}
            <span className="font-mono font-semibold text-white/90">{transaction.reference_number}</span>
          </p>
        ) : null}
        {demoNote ? <p className="mx-auto mt-3 max-w-md text-xs text-white/60">{demoNote}</p> : null}
        {uetr ? (
          <p className="mx-auto mt-4 max-w-lg rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white/90">
            <span className="font-semibold text-white">UETR</span> (end-to-end tracking):{' '}
            <span className="font-mono break-all">{uetr}</span>
          </p>
        ) : null}
      </div>

      {receiptSnapshot ? (
        <>
          <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-5 sm:px-6">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
              Your receipt
            </p>
            <div className="mx-auto max-w-[320px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="max-h-[min(52vh,420px)] overflow-auto">
                <div className="flex justify-center p-3">
                  <div className="origin-top scale-[0.52] sm:scale-[0.58]">
                    <TransactionReceiptDocument snapshot={receiptSnapshot} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="fixed -left-[10000px] top-0 pointer-events-none" aria-hidden>
            <TransactionReceiptDocument ref={receiptRef} snapshot={receiptSnapshot} />
          </div>

          <div className="space-y-2 border-b border-gray-100 px-6 py-5 sm:px-8">
            <ReceiptFormatMenu
              label="Download receipt"
              icon={<Download size={16} aria-hidden />}
              variant="primary"
              onPick={(format) => exportReceipt(format, 'download')}
            />
            <ReceiptFormatMenu
              label="Share receipt"
              icon={<Share2 size={16} aria-hidden />}
              variant="outline"
              onPick={(format) => exportReceipt(format, 'share')}
            />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row sm:justify-center sm:px-8">
        <button type="button" onClick={onDashboard} className="btn-primary px-8 py-3 text-sm">
          Back to dashboard
        </button>
        <button type="button" onClick={onAnother} className="btn-outline px-8 py-3 text-sm">
          Another transfer
        </button>
      </div>
    </div>
  )
}
