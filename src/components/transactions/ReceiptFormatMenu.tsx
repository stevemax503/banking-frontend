import { useState, type ReactNode } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { ChevronDown, FileImage, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ReceiptFormat } from '@/lib/transactionReceiptExport'

type Props = {
  label: string
  icon: ReactNode
  variant?: 'primary' | 'outline'
  disabled?: boolean
  onPick: (format: ReceiptFormat) => Promise<void>
}

export default function ReceiptFormatMenu({ label, icon, variant = 'outline', disabled, onPick }: Props) {
  const [busy, setBusy] = useState(false)

  const run = async (format: ReceiptFormat, close: () => void) => {
    setBusy(true)
    try {
      await onPick(format)
      close()
    } finally {
      setBusy(false)
    }
  }

  const buttonClass =
    variant === 'primary'
      ? 'btn-primary w-full text-sm py-2.5'
      : 'btn-outline w-full text-sm py-2.5'

  return (
    <Popover className="relative w-full">
      <PopoverButton
        disabled={disabled || busy}
        className={cn(
          buttonClass,
          'flex items-center justify-center gap-2 disabled:opacity-50',
        )}
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
        {label}
        {!busy ? <ChevronDown size={14} className="opacity-70" aria-hidden /> : null}
      </PopoverButton>

      <PopoverPanel className="absolute bottom-full left-0 right-0 z-[60] mb-1 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
        {({ close }) => (
          <>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => void run('pdf', close)}
            >
              <FileText size={16} className="text-primary-dark" aria-hidden />
              PDF
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => void run('png', close)}
            >
              <FileImage size={16} className="text-primary-dark" aria-hidden />
              Image (PNG)
            </button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}
