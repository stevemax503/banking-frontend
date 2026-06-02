import { forwardRef } from 'react'
import { SafaPayIcon } from '@/components/brand/SafaPayLogo'
import { BANK_LOGO_WORDMARK, BANK_RECEIPT_CHANNELS_LINE } from '@/lib/brand'
import type { ReceiptSnapshot } from '@/lib/transactionReceiptExport'

/** Brand tokens for html2canvas export (matches tailwind primary / accent). */
const PRIMARY_DARK = '#152A1E'
const PRIMARY = '#1E3A2A'
const PRIMARY_LIGHT = '#2D5040'
const ACCENT = '#C8F000'

type Props = {
  snapshot: ReceiptSnapshot
}

function ReceiptRowBlock({ label, value }: { label: string; value: string }) {
  const lines = value.split('\n').filter((l, _i, arr) => l.length > 0 || arr.length === 1)
  return (
    <div className="flex border-b py-3.5 text-[13px] leading-snug" style={{ borderColor: '#e5ebe8' }}>
      <div className="w-[42%] shrink-0 pr-3 font-bold" style={{ color: PRIMARY_DARK }}>
        {label}
      </div>
      <div
        className="min-w-0 flex-1 font-semibold whitespace-pre-wrap break-words text-[#1f2937]"
      >
        {lines.map((line, i) => (
          <span key={`${label}-${i}`} className="block">
            {line || '—'}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Access-style receipt with SafaPay brand colours. */
const TransactionReceiptDocument = forwardRef<HTMLDivElement, Props>(function TransactionReceiptDocument(
  { snapshot },
  ref,
) {
  return (
    <div
      ref={ref}
      className="w-[560px] bg-white text-[#333]"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* Primary accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: PRIMARY_DARK }} />
      <div className="h-0.5 w-full" style={{ backgroundColor: ACCENT }} />

      {/* Header */}
      <div className="flex items-center px-6 pt-5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <SafaPayIcon className="h-9 w-9 shrink-0" />
          <span className="text-xl font-bold lowercase tracking-tight" style={{ color: PRIMARY_DARK }}>
            {BANK_LOGO_WORDMARK.replace(/\s*bank\s*$/i, '')}
            <span style={{ color: PRIMARY }}> bank</span>
          </span>
        </div>
        <div
          className="mx-4 h-10 w-[3px] shrink-0 rotate-[28deg] rounded-full"
          style={{ backgroundColor: ACCENT }}
          aria-hidden
        />
        <p className="text-[11px] font-medium leading-tight max-w-[7rem]" style={{ color: PRIMARY_LIGHT }}>
          {snapshot.tagline}
        </p>
      </div>

      <div className="px-6 pb-2">
        <h1 className="text-center text-[22px] font-bold tracking-tight" style={{ color: PRIMARY_DARK }}>
          Transaction Receipt
        </h1>
        <div className="mx-auto mt-2 h-0.5 w-16 rounded-full" style={{ backgroundColor: ACCENT }} />
        <p className="mt-2 text-center text-[12px] text-[#888]">
          Generated from{' '}
          <span className="font-semibold" style={{ color: PRIMARY }}>
            {snapshot.generatedChannel}
          </span>{' '}
          on <span className="font-semibold text-[#555]">{snapshot.generatedAt}</span>
        </p>
      </div>

      {/* Detail rows */}
      <div className="mx-6 mt-4 border-t border-[#dce5e0]">
        {snapshot.rows.map((row) => (
          <ReceiptRowBlock key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="mx-6 mt-6 border-t px-2 py-5 text-center text-[11px] leading-relaxed text-[#888]"
        style={{ borderColor: '#e5ebe8', backgroundColor: '#f7faf8' }}
      >
        <p>{snapshot.footerNote}</p>
        <p className="mt-3 font-medium" style={{ color: PRIMARY_DARK }}>
          Thank you for choosing {snapshot.bankName}.
        </p>
        <p className="mt-2 text-[10px] text-[#777]">
          Banking with {snapshot.bankName}: {BANK_RECEIPT_CHANNELS_LINE}
        </p>
      </div>
    </div>
  )
})

export default TransactionReceiptDocument
