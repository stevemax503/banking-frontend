import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Banknote,
  Bitcoin,
  CheckCircle2,
  Copy,
  Landmark,
  Paperclip,
  Shield,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency } from '@/utils/format'
import {
  type AdminPaymentAvailability,
  type CompliancePaymentMethodOption,
  type CryptoAssetId,
  type UsdtNetworkId,
  MOCK_CRYPTO_WALLETS,
  MOCK_USDT_ADDRESSES,
  MOCK_WIRE_INSTRUCTIONS,
  USDT_NETWORKS,
  cryptoPaymentWarning,
} from './compliancePaymentMockData'

type Props = {
  open: boolean
  onClose: () => void
  availableMethods: AdminPaymentAvailability
  feeName?: string
  feeAmount?: string
  feeCurrency?: string
  anchorToMain?: boolean
}

type Step = 'method' | 'pay' | 'submitted'

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=6&data=${encodeURIComponent(data)}`
}

function CopyField({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy')
    }
  }
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 ring-1 ring-inset',
        highlight ? 'bg-primary-dark/[0.06] ring-primary-dark/15' : 'bg-gray-50/90 ring-gray-100',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="truncate font-mono text-[11px] font-medium text-gray-900" title={value}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white hover:text-primary-dark"
        title={`Copy ${label}`}
      >
        <Copy size={13} aria-hidden />
      </button>
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/80',
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition',
            value === opt.id
              ? 'bg-white text-primary-dark shadow-sm'
              : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function WirePanel({ amount, currency }: { amount: string; currency: string }) {
  const w = MOCK_WIRE_INSTRUCTIONS
  const reference = w.payment_reference
  const accountRows = [
    { label: 'Beneficiary', value: w.beneficiary_legal_name.trim() },
    { label: 'Bank', value: w.beneficiary_bank_name.trim() },
    { label: 'Bank address', value: w.beneficiary_bank_address.trim() },
    { label: 'SWIFT / BIC', value: w.beneficiary_bic_swift.trim() },
    { label: 'IBAN', value: w.beneficiary_iban.trim() },
    { label: 'Country', value: w.beneficiary_bank_country.trim() },
  ].filter((row) => row.value)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
      <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-sky-950 ring-1 ring-sky-100">
        Send a SWIFT wire transfer using the amount, reference, and bank details below.
      </p>

      <div>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Your payment</h4>
        <div className="overflow-hidden rounded-xl border border-primary-dark/10 bg-primary-dark/[0.03] divide-y divide-primary-dark/10">
          <WireHighlightField label="Amount" value={`${currency} ${formatDisplayCurrency(amount)}`} />
          <WireHighlightField label="Payment reference" value={reference} />
        </div>
      </div>

      {accountRows.length > 0 ? (
        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Wire to this account</h4>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {accountRows.map((row) => (
              <WireCompactField key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WireHighlightField({ label, value }: { label: string; value: string }) {
  if (!value) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }
  return (
    <div className="rounded-xl bg-primary-dark/[0.05] px-3 py-3 text-center ring-1 ring-inset ring-primary-dark/10">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 break-all font-mono text-sm font-semibold leading-snug text-gray-900">{value}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-primary-dark transition hover:bg-white"
      >
        <Copy size={11} aria-hidden />
        Copy
      </button>
    </div>
  )
}

function WireCompactField({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }
  return (
    <div className="rounded-lg bg-white px-2.5 py-2.5 text-center ring-1 ring-inset ring-gray-100">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] font-medium leading-snug text-gray-900">{value}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary-dark transition hover:bg-gray-50"
      >
        <Copy size={11} aria-hidden />
        Copy
      </button>
    </div>
  )
}

function CryptoPanel({
  amount,
  currency,
}: {
  amount: string
  currency: string
}) {
  const [asset, setAsset] = useState<CryptoAssetId>('btc')
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetworkId>('erc20')

  const wallet = MOCK_CRYPTO_WALLETS[asset]
  const address = asset === 'usdt' ? MOCK_USDT_ADDRESSES[usdtNetwork] : wallet.address
  const paymentWarning = cryptoPaymentWarning(asset, usdtNetwork)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { id: 'btc' as const, icon: Bitcoin, label: 'Bitcoin' },
            { id: 'usdt' as const, icon: Banknote, label: 'USDT' },
            { id: 'eth' as const, icon: Landmark, label: 'Ethereum' },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAsset(id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold ring-1 ring-inset transition',
              asset === id
                ? 'bg-primary-dark text-white ring-primary-dark'
                : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
            )}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {asset === 'usdt' ? (
        <Segmented
          options={USDT_NETWORKS.map((n) => ({ id: n.id, label: n.label }))}
          value={usdtNetwork}
          onChange={setUsdtNetwork}
        />
      ) : null}

      {paymentWarning ? (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-center text-[10px] font-medium leading-relaxed text-amber-900 ring-1 ring-amber-100">
          {paymentWarning}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[7.5rem_1fr] gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-2 ring-1 ring-gray-100">
          <img
            src={qrUrl(address)}
            alt=""
            width={120}
            height={120}
            className="rounded-md"
          />
          <p className="mt-1 text-[9px] font-medium text-gray-400">Scan to pay</p>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <CopyField
            label="Amount"
            value={`${formatDisplayCurrency(amount)} ${currency}`}
            highlight
          />
          <CopyField label={`${wallet.symbol} address`} value={address} />
        </div>
      </div>
    </div>
  )
}

function MethodPicker({
  onSelect,
}: {
  onSelect: (m: CompliancePaymentMethodOption) => void
}) {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSelect('crypto')}
        className="group flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gray-50 to-white p-4 ring-1 ring-gray-200 transition hover:ring-primary-dark/25 hover:shadow-md"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <Bitcoin size={22} aria-hidden />
        </span>
        <span className="text-sm font-semibold text-gray-900">Crypto</span>
        <span className="text-center text-[10px] leading-snug text-gray-500">BTC · USDT · ETH</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect('wire')}
        className="group flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gray-50 to-white p-4 ring-1 ring-gray-200 transition hover:ring-primary-dark/25 hover:shadow-md"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-dark/10 text-primary-dark ring-1 ring-primary-dark/10">
          <Landmark size={22} aria-hidden />
        </span>
        <span className="text-sm font-semibold text-gray-900">Bank wire</span>
        <span className="text-center text-[10px] leading-snug text-gray-500">SWIFT / international</span>
      </button>
    </div>
  )
}

export default function CompliancePaymentModalMock({
  open,
  onClose,
  availableMethods,
  feeName = 'YTRD',
  feeAmount = '8000000.00',
  feeCurrency = 'USD',
  anchorToMain = true,
}: Props) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [step, setStep] = useState<Step>('method')
  const [method, setMethod] = useState<CompliancePaymentMethodOption | null>(null)

  const methods = useMemo((): CompliancePaymentMethodOption[] => {
    if (availableMethods === 'both') return ['crypto', 'wire']
    return [availableMethods]
  }, [availableMethods])

  useEffect(() => {
    if (!anchorToMain) {
      setPortalTarget(document.body)
      return
    }
    setPortalTarget(document.getElementById('app-main-pane') ?? document.body)
  }, [anchorToMain, open])

  useEffect(() => {
    if (!open) {
      setStep('method')
      setMethod(null)
      return
    }
    if (methods.length === 1) {
      setMethod(methods[0])
      setStep('pay')
    }
  }, [open, methods])

  if (!open || !portalTarget) return null

  const overlayClass =
    portalTarget.id === 'app-main-pane'
      ? 'absolute inset-0 z-[85] flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-[3px]'
      : 'fixed inset-0 z-[85] flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-[3px]'

  const showMethodPicker = availableMethods === 'both' && step === 'method'
  const showMethodToggle = availableMethods === 'both' && step === 'pay'

  const selectMethod = (m: CompliancePaymentMethodOption) => {
    setMethod(m)
    setStep('pay')
  }

  return createPortal(
    <div className={overlayClass} role="dialog" aria-modal="true" aria-labelledby="compliance-pay-title">
      <div
        className={cn(
          'flex w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-white/20',
          'bg-white shadow-[0_32px_64px_-16px_rgba(21,42,30,0.35)]',
          'h-[min(580px,calc(100vh-2rem))]',
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 border-b border-gray-100 bg-gradient-to-br from-primary-dark via-primary-dark to-primary px-5 pb-4 pt-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Shield size={18} className="text-accent" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 id="compliance-pay-title" className="text-sm font-semibold tracking-tight">
                Pay compliance fee
              </h3>
              <p className="mt-0.5 text-[11px] text-white/75">Resume anytime from Loans</p>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">{feeName}</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {formatDisplayCurrency(feeAmount)}
              </p>
            </div>
            <span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 ring-1 ring-white/20">
              {feeCurrency}
            </span>
          </div>
          {showMethodToggle ? (
            <div className="mt-3">
              <Segmented
                options={[
                  { id: 'crypto', label: 'Crypto' },
                  { id: 'wire', label: 'Bank wire' },
                ]}
                value={method ?? 'crypto'}
                onChange={(id) => setMethod(id)}
              />
            </div>
          ) : null}
        </div>

        {/* Body — fixed height, no scroll */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
          {showMethodPicker ? <MethodPicker onSelect={selectMethod} /> : null}

          {step === 'pay' && method === 'crypto' ? (
            <CryptoPanel amount={feeAmount} currency={feeCurrency} />
          ) : null}

          {step === 'pay' && method === 'wire' ? (
            <WirePanel amount={feeAmount} currency={feeCurrency} />
          ) : null}

          {step === 'submitted' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-gray-900">Payment submitted</p>
              <p className="max-w-[16rem] text-[11px] leading-relaxed text-gray-500">
                We&apos;ll confirm your {method === 'crypto' ? 'transfer' : 'wire'} and email your verification
                code.
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-4 py-3">
          {step === 'pay' ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary w-full py-2.5 text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(21,42,30,0.5)]"
                onClick={() => setStep('submitted')}
              >
                I&apos;ve sent payment
              </button>
              <div className="flex items-center justify-between">
                {methods.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary-dark"
                    onClick={() => {
                      setStep('method')
                      setMethod(null)
                    }}
                  >
                    <ArrowLeft size={12} aria-hidden />
                    Change method
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary-dark"
                  onClick={() => toast('Proof upload — mock')}
                >
                  <Paperclip size={12} aria-hidden />
                  Upload proof of payment
                </button>
              </div>
            </div>
          ) : step === 'submitted' ? (
            <button type="button" className="btn-primary w-full py-2.5 text-sm font-semibold" onClick={onClose}>
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
