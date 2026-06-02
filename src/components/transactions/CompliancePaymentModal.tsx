import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Banknote, Bitcoin, Copy, Landmark, Loader2, Paperclip, Shield, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDisplayCurrency } from '@/utils/format'
import { countryDisplayName, useLocationDataset } from '@/lib/locationData'
import type {
  CompliancePaymentInstructions,
  CompliancePaymentMethodOption,
} from '@/types/compliancePayment'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (paymentProof?: File | null) => void
  submitting?: boolean
  feeName: string
  feeAmount: string
  feeCurrency?: string
  paymentReference: string
  instructions: CompliancePaymentInstructions
  anchorToMain?: boolean
  /** Where the customer can resume this flow after closing the modal. */
  resumeFrom?: 'loan' | 'transfer'
}

type CryptoAssetId = 'btc' | 'usdt' | 'eth'
type UsdtNetworkId = 'erc20' | 'trc20' | 'bep20'

const USDT_NETWORKS: { id: UsdtNetworkId; label: string; warning: string }[] = [
  {
    id: 'erc20',
    label: 'ERC-20',
    warning: 'Send USDT (ERC-20) only to this address. Other assets will be lost forever.',
  },
  {
    id: 'trc20',
    label: 'TRC-20',
    warning: 'Send USDT (TRC-20) only to this address. Other assets will be lost forever.',
  },
  {
    id: 'bep20',
    label: 'BEP-20',
    warning: 'Send USDT (BEP-20) only to this address. Other assets will be lost forever.',
  },
]

const CRYPTO_ASSET_WARNINGS: Record<Exclude<CryptoAssetId, 'usdt'>, string> = {
  btc: 'Send Bitcoin (BTC) only to this address. Other assets will be lost forever.',
  eth: 'Send Ethereum (ETH) only to this address. Other assets will be lost forever.',
}

function cryptoPaymentWarning(
  asset: CryptoAssetId,
  usdtNetwork: UsdtNetworkId,
  usdtNetworks: { id: UsdtNetworkId; warning: string }[],
): string | null {
  if (asset === 'usdt') {
    return usdtNetworks.find((n) => n.id === usdtNetwork)?.warning ?? null
  }
  return CRYPTO_ASSET_WARNINGS[asset]
}

function copyValue(value: string, label: string) {
  return async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy')
    }
  }
}

function CopyField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null
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
        onClick={copyValue(value, label)}
        className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-white hover:text-primary-dark"
      >
        <Copy size={13} aria-hidden />
      </button>
    </div>
  )
}

function WireDetailRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  if (!value.trim()) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p
          className={cn(
            'mt-0.5 break-words leading-snug text-gray-900',
            emphasis ? 'font-mono text-sm font-bold' : 'font-mono text-xs font-medium',
          )}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copyValue(value, label)}
        className="mt-0.5 shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-primary-dark"
        aria-label={`Copy ${label}`}
      >
        <Copy size={14} aria-hidden />
      </button>
    </div>
  )
}

function WireSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</h4>
      {children}
    </section>
  )
}

function WirePanel({
  wire,
  amount,
  currency,
  reference,
}: {
  wire: CompliancePaymentInstructions['wire']
  amount: string
  currency: string
  reference: string
}) {
  const { data: csc } = useLocationDataset()
  const beneficiaryName = (wire.beneficiary_name ?? '').trim()
  const bankName = (wire.bank_name ?? '').trim()
  const bankAddress = (wire.bank_address ?? '').trim()
  const swiftBic = (wire.swift_bic ?? '').trim()
  const iban = (wire.iban ?? '').trim()
  const accountNumber = (wire.account_number ?? '').trim()
  const accountLabel = iban ? 'IBAN' : 'Account number'
  const accountValue = iban || accountNumber
  const countryRaw = (wire.country ?? '').trim()
  const countryLabel = countryRaw ? countryDisplayName(csc, countryRaw) : ''

  const accountRows = [
    { label: 'Beneficiary', value: beneficiaryName },
    { label: 'Bank', value: bankName },
    { label: 'Bank address', value: bankAddress },
    { label: 'SWIFT / BIC', value: swiftBic },
    { label: accountLabel, value: accountValue },
    { label: 'Country', value: countryLabel },
  ].filter((row) => row.value)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
      <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-sky-950 ring-1 ring-sky-100">
        Send a SWIFT wire transfer using the amount, reference, and bank details below.
      </p>

      <WireSection title="Your payment">
        <div className="overflow-hidden rounded-xl border border-primary-dark/10 bg-primary-dark/[0.03] divide-y divide-primary-dark/10">
          <WireDetailRow label="Amount" value={`${currency} ${formatDisplayCurrency(amount)}`} emphasis />
          <WireDetailRow label="Payment reference" value={reference} emphasis />
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-amber-900/90">
          Include the payment reference exactly — your wire may not be matched without it.
        </p>
      </WireSection>

      {accountRows.length > 0 ? (
        <WireSection title="Wire to this account">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {accountRows.map((row) => (
              <WireDetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </WireSection>
      ) : null}
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/80" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition',
            value === opt.id ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CryptoPanel({
  crypto,
  amount,
  currency,
}: {
  crypto: CompliancePaymentInstructions['crypto']
  amount: string
  currency: string
}) {
  const assets = useMemo(() => {
    const list: CryptoAssetId[] = []
    if (crypto.btc) list.push('btc')
    if (crypto.usdt && Object.keys(crypto.usdt).length) list.push('usdt')
    if (crypto.eth) list.push('eth')
    return list
  }, [crypto])

  const [asset, setAsset] = useState<CryptoAssetId>(assets[0] ?? 'btc')
  const usdtNetworks = useMemo(() => {
    if (!crypto.usdt) return []
    return USDT_NETWORKS.filter((n) => crypto.usdt?.[n.id])
  }, [crypto.usdt])
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetworkId>(usdtNetworks[0]?.id ?? 'erc20')

  useEffect(() => {
    if (assets.length && !assets.includes(asset)) setAsset(assets[0])
  }, [assets, asset])

  useEffect(() => {
    if (usdtNetworks.length && !usdtNetworks.some((n) => n.id === usdtNetwork)) {
      setUsdtNetwork(usdtNetworks[0].id)
    }
  }, [usdtNetworks, usdtNetwork])

  const address =
    asset === 'btc'
      ? crypto.btc ?? ''
      : asset === 'eth'
        ? crypto.eth ?? ''
        : crypto.usdt?.[usdtNetwork] ?? ''

  const symbol = asset === 'btc' ? 'BTC' : asset === 'eth' ? 'ETH' : 'USDT'
  const paymentWarning = cryptoPaymentWarning(asset, usdtNetwork, usdtNetworks)

  if (!assets.length) {
    return <p className="text-center text-sm text-gray-500">Crypto payment is not configured for this fee.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <div className={cn('grid gap-1.5', assets.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {assets.map((id) => {
          const Icon = id === 'btc' ? Bitcoin : id === 'eth' ? Landmark : Banknote
          const label = id === 'btc' ? 'Bitcoin' : id === 'eth' ? 'Ethereum' : 'USDT'
          return (
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
          )
        })}
      </div>
      {asset === 'usdt' && usdtNetworks.length > 1 ? (
        <Segmented
          options={usdtNetworks.map((n) => ({ id: n.id, label: n.label }))}
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
          {address ? (
            <QRCodeSVG value={address} size={112} level="M" includeMargin />
          ) : null}
          <p className="mt-1 text-[9px] font-medium text-gray-400">Scan to pay</p>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <CopyField label="Amount" value={`${formatDisplayCurrency(amount)} ${currency}`} highlight />
          <CopyField label={`${symbol} address`} value={address} />
        </div>
      </div>
    </div>
  )
}

export default function CompliancePaymentModal({
  open,
  onClose,
  onSubmit,
  submitting,
  feeName,
  feeAmount,
  feeCurrency = 'USD',
  paymentReference,
  instructions,
  anchorToMain = true,
  resumeFrom = 'transfer',
}: Props) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [method, setMethod] = useState<CompliancePaymentMethodOption>('crypto')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const methods = useMemo((): CompliancePaymentMethodOption[] => {
    const m: CompliancePaymentMethodOption[] = []
    if (instructions.crypto_enabled) m.push('crypto')
    if (instructions.wire_enabled) m.push('wire')
    return m
  }, [instructions])

  useEffect(() => {
    if (!anchorToMain) {
      setPortalTarget(document.body)
      return
    }
    setPortalTarget(document.getElementById('app-main-pane') ?? document.body)
  }, [anchorToMain, open])

  useEffect(() => {
    if (open && methods.length) setMethod(methods[0])
  }, [open, methods])

  useEffect(() => {
    if (!open) setProofFile(null)
  }, [open])

  if (!open || !portalTarget) return null

  const overlayClass =
    portalTarget.id === 'app-main-pane'
      ? 'absolute inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-[3px]'
      : 'fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-[3px]'

  return createPortal(
    <div className={overlayClass} role="dialog" aria-modal="true">
      <div className="flex h-[min(580px,calc(100vh-2rem))] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_32px_64px_-16px_rgba(21,42,30,0.35)]">
        <div className="relative shrink-0 border-b border-gray-100 bg-gradient-to-br from-primary-dark via-primary-dark to-primary px-5 pb-4 pt-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Shield size={18} className="text-accent" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Pay compliance fee</h3>
              <p className="mt-0.5 text-[11px] text-white/75">
                Resume anytime from {resumeFrom === 'loan' ? 'Loans' : 'Transactions'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-white/75">Fee · {feeName}</p>
              <p className="text-2xl font-bold tabular-nums">{formatDisplayCurrency(feeAmount)}</p>
            </div>
            <span className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold ring-1 ring-white/20">
              {feeCurrency}
            </span>
          </div>
          {methods.length > 1 ? (
            <div className="mt-3">
              <Segmented
                options={[
                  { id: 'crypto', label: 'Crypto' },
                  { id: 'wire', label: 'Bank wire' },
                ]}
                value={method}
                onChange={setMethod}
              />
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
          {methods.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Payment details are not configured for this fee.</p>
          ) : method === 'crypto' && instructions.crypto_enabled ? (
            <CryptoPanel
              crypto={instructions.crypto}
              amount={feeAmount}
              currency={feeCurrency}
            />
          ) : instructions.wire_enabled ? (
            <WirePanel wire={instructions.wire} amount={feeAmount} currency={feeCurrency} reference={paymentReference} />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-4 py-3">
          <button
            type="button"
            disabled={submitting || methods.length === 0}
            className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() => onSubmit(proofFile)}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              "I've sent payment"
            )}
          </button>
          <div className="mt-2 flex items-center justify-between gap-3">
            {methods.length > 1 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary-dark"
                onClick={onClose}
              >
                <ArrowLeft size={12} aria-hidden />
                Back to verification
              </button>
            ) : (
              <span aria-hidden />
            )}
            <label className="inline-flex max-w-[52%] shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary-dark">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="sr-only"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              <Paperclip size={12} className="shrink-0" aria-hidden />
              <span className="truncate" title={proofFile?.name}>
                {proofFile ? proofFile.name : 'Upload proof of payment'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
