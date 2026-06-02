import { format } from 'date-fns'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { TransactionListItem } from '@/utils/transactionDisplay'
import { formatTransactionStatusLabel, transactionNarration } from '@/utils/transactionDisplay'
import { formatDisplayCurrency } from '@/utils/format'
import { BANK_NAME, BANK_RECEIPT_CHANNEL, BANK_SUPPORT_EMAIL, BANK_TAGLINE } from '@/lib/brand'

export type ReceiptFormat = 'pdf' | 'png'

export type ReceiptRow = {
  label: string
  value: string
}

export type ReceiptSnapshot = {
  bankName: string
  tagline: string
  generatedChannel: string
  generatedAt: string
  rows: ReceiptRow[]
  footerNote: string
  reference: string
}

function strMeta(meta: Record<string, unknown> | null | undefined, key: string): string {
  const v = meta?.[key]
  return typeof v === 'string' ? v.trim() : ''
}

function extractRemark(description: string): string {
  const m = (description || '').trim().match(/\(([^()]*)\)\s*$/)
  return m ? m[1].trim() : ''
}

function receiptTransactionType(type: string): string {
  switch (type) {
    case 'TRANSFER_INTERNAL':
      return 'INTERNAL'
    case 'TRANSFER_EXTERNAL':
      return 'INTER-BANK'
    case 'TRANSFER_INTERNATIONAL':
      return 'INTERNATIONAL'
    case 'WITHDRAWAL':
      return 'WITHDRAWAL'
    case 'LOAN_PAYMENT':
      return 'LOAN PAYMENT'
    default:
      return type.replace(/_/g, '-').toUpperCase()
  }
}

function receiptStatusLabel(tx: TransactionListItem): string {
  const kind = tx.transaction_type.includes('TRANSFER')
    ? 'Transfer'
    : tx.transaction_type === 'WITHDRAWAL'
      ? 'Withdrawal'
      : tx.transaction_type === 'LOAN_PAYMENT'
        ? 'Loan payment'
        : 'Transaction'
  switch (tx.status) {
    case 'COMPLETED':
      return `${kind} request successful`
    case 'PENDING':
      return `${kind} pending`
    case 'FAILED':
      return `${kind} failed`
    default:
      return formatTransactionStatusLabel(tx.status)
  }
}

function formatReceiptDate(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return iso
  }
}

function formatGeneratedStamp(): string {
  return format(new Date(), 'dd/MM/yy HH:mm:ss')
}

function buildBeneficiaryBlock(tx: TransactionListItem): string {
  const meta = tx.metadata || {}
  const intl = meta.international_wire
  const intlObj = intl && typeof intl === 'object' ? (intl as Record<string, unknown>) : null

  const lines: string[] = []
  const name =
    strMeta(meta, 'recipient_account_holder_name') ||
    (intlObj && typeof intlObj.beneficiary_legal_name === 'string'
      ? intlObj.beneficiary_legal_name.trim()
      : '')
  const account =
    tx.to_account_number ||
    strMeta(meta, 'destination_account_number') ||
    (intlObj && typeof intlObj.beneficiary_iban === 'string' ? intlObj.beneficiary_iban.trim() : '')
  const bank =
    strMeta(meta, 'external_bank_name') ||
    (intlObj && typeof intlObj.beneficiary_bank_name === 'string'
      ? intlObj.beneficiary_bank_name.trim()
      : '')

  if (name) lines.push(name)
  if (account) lines.push(account)
  if (bank) lines.push(bank)

  if (lines.length === 0) {
    const narr = transactionNarration(tx)
    return narr || '—'
  }
  return lines.join('\n')
}

export function buildReceiptSnapshot(
  tx: TransactionListItem,
  options: { senderName: string },
): ReceiptSnapshot {
  const when = tx.completed_at || tx.created_at
  const reference = tx.reference_number || tx.id
  const sessionId = reference.replace(/^TXN/i, '') || tx.id.replace(/-/g, '')
  const remark = extractRemark(tx.description || '')

  const senderAccount = tx.from_account_number
    ? `${options.senderName}\n${tx.from_account_number}`
    : options.senderName

  const rows: ReceiptRow[] = [
    { label: 'Transaction Amount', value: formatDisplayCurrency(tx.amount) },
    { label: 'Transaction Type', value: receiptTransactionType(tx.transaction_type) },
    { label: 'Transaction Date', value: formatReceiptDate(when) },
    { label: 'Sender', value: senderAccount },
    { label: 'Beneficiary', value: buildBeneficiaryBlock(tx) },
    { label: 'Remark', value: remark || '—' },
    { label: 'Transaction Reference', value: reference },
    { label: 'Session Id', value: sessionId },
    { label: 'Transaction Status', value: receiptStatusLabel(tx) },
  ]

  return {
    bankName: BANK_NAME,
    tagline: BANK_TAGLINE,
    generatedChannel: BANK_RECEIPT_CHANNEL,
    generatedAt: formatGeneratedStamp(),
    rows,
    footerNote: `For further enquiries, please contact our team on ${BANK_SUPPORT_EMAIL}`,
    reference,
  }
}

export function receiptFilename(reference: string, format: ReceiptFormat): string {
  const safe = reference.replace(/[^a-zA-Z0-9-_]/g, '_')
  return `receipt-${safe}.${format === 'pdf' ? 'pdf' : 'png'}`
}

export async function renderReceiptCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
  })
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create image.'))
    }, 'image/png')
  })
}

export async function downloadReceiptFromCanvas(
  canvas: HTMLCanvasElement,
  format: ReceiptFormat,
  filename: string,
): Promise<void> {
  if (format === 'png') {
    const blob = await canvasToPngBlob(canvas)
    triggerBlobDownload(blob, filename)
    return
  }

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const maxWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * maxWidth) / canvas.width
  const y = Math.max(margin, (pageHeight - imgHeight) / 2)
  pdf.addImage(imgData, 'PNG', margin, y, maxWidth, imgHeight)
  pdf.save(filename)
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function shareReceiptBlob(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type })
  const canShareFiles =
    typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [file] }))

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: title,
      })
      return 'shared'
    } catch (err) {
      // If the user cancels the native share sheet, treat it as a no-op rather than an error.
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') return 'cancelled'
      // Some browsers throw even when canShare returns true; fall back to download.
    }
  }

  triggerBlobDownload(blob, filename)
  return 'downloaded'
}

export async function shareReceiptFromCanvas(
  canvas: HTMLCanvasElement,
  format: ReceiptFormat,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (format === 'png') {
    const blob = await canvasToPngBlob(canvas)
    return shareReceiptBlob(blob, filename, title)
  }

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 12
  const maxWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * maxWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', margin, 12, maxWidth, imgHeight)
  const blob = pdf.output('blob')
  return shareReceiptBlob(blob, filename, title)
}
