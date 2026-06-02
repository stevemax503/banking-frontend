import {
  ShoppingBag, UtensilsCrossed, Briefcase, Plane, Clapperboard, LayoutGrid,
  type LucideIcon,
} from 'lucide-react'

export type UiCategory =
  | 'all'
  | 'shopping'
  | 'dining'
  | 'services'
  | 'travel'
  | 'entertainment'
  | 'other'

export type ComplianceResumeInfo = {
  session_id: string
  session_status: string
  lines_total: number
  lines_verified: number
  expires_at: string
  is_expired: boolean
  can_resume: boolean
}

export interface TransactionListItem {
  id: string
  reference_number: string
  transaction_type: string
  amount: string
  currency: string
  description: string
  status: string
  created_at: string
  completed_at?: string | null
  from_account?: string | null
  to_account?: string | null
  from_account_number?: string | null
  to_account_number?: string | null
  regulated_session_id?: string | null
  compliance_resume?: ComplianceResumeInfo | null
  metadata?: Record<string, unknown> | null
}

const CATEGORY_META: Record<
  Exclude<UiCategory, 'all'>,
  { label: string; Icon: LucideIcon; badgeClass: string }
> = {
  shopping: { label: 'Shopping', Icon: ShoppingBag, badgeClass: 'bg-blue-100 text-blue-800' },
  dining: { label: 'Dining', Icon: UtensilsCrossed, badgeClass: 'bg-emerald-100 text-emerald-800' },
  services: { label: 'Services', Icon: Briefcase, badgeClass: 'bg-violet-100 text-violet-800' },
  travel: { label: 'Travel', Icon: Plane, badgeClass: 'bg-amber-100 text-amber-900' },
  entertainment: { label: 'Entertainment', Icon: Clapperboard, badgeClass: 'bg-pink-100 text-pink-800' },
  other: { label: 'Other', Icon: LayoutGrid, badgeClass: 'bg-gray-100 text-gray-700' },
}

export const CATEGORY_OPTIONS: {
  id: UiCategory
  label: string
  Icon: LucideIcon
}[] = [
  { id: 'all', label: 'All Categories', Icon: LayoutGrid },
  ...(
    [
      'shopping',
      'dining',
      'services',
      'travel',
      'entertainment',
      'other',
    ] as const
  ).map((id) => ({
    id,
    label: CATEGORY_META[id].label,
    Icon: CATEGORY_META[id].Icon,
  })),
]

export function inferCategory(tx: { description?: string; transaction_type: string }): Exclude<UiCategory, 'all'> {
  const d = (tx.description || '').toLowerCase()
  if (/coffee|cafe|restaurant|dining|lunch|food\b|uber\s*eats|doordash/.test(d)) return 'dining'
  if (/apple|amazon|grocery|market|shop|store|retail|purchase/.test(d)) return 'shopping'
  if (/flight|hotel|travel|uber|lyft|airline|train|booking/.test(d)) return 'travel'
  if (/netflix|spotify|entertainment|cinema|game|streaming/.test(d)) return 'entertainment'
  if (/fee|service|utility|bill|insurance|subscription/.test(d)) return 'services'
  const t = tx.transaction_type
  if (t === 'FEE' || t === 'LOAN_PAYMENT') return 'services'
  if (t === 'INTEREST') return 'services'
  if (t === 'DEPOSIT') return 'other'
  if (t === 'WITHDRAWAL') return 'other'
  if (t.includes('TRANSFER')) return 'services'
  return 'other'
}

export function getCategoryMeta(cat: Exclude<UiCategory, 'all'>) {
  return CATEGORY_META[cat]
}

export function merchantLabel(tx: TransactionListItem): string {
  const raw = (tx.description || '').trim()
  if (raw) {
    const first = raw.split(/[—\-–|·]/)[0].trim()
    if (first.length > 0 && first.length <= 80) return first
    return raw.slice(0, 60) + (raw.length > 60 ? '…' : '')
  }
  return tx.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Short line for lists and tables (avoids full bill-pay narration blocks). */
export function transactionNarrationBrief(tx: TransactionListItem, maxLen = 80): string {
  const full = merchantLabel(tx)
  return full.length <= maxLen ? full : `${full.slice(0, maxLen - 1)}…`
}

/** Full customer-visible description (includes reference; memo in parentheses). */
export function transactionNarration(tx: TransactionListItem): string {
  const raw = (tx.description || '').trim()
  if (raw) return raw
  const meta = tx.metadata
  const system = meta?.system_narration
  if (typeof system === 'string' && system.trim()) {
    const ref = (tx.reference_number || '').trim()
    return ref && !system.includes(ref) ? `${system}${ref}` : system.trim()
  }
  const narr = meta?.deposit_narration
  if (typeof narr === 'string' && narr.trim()) return narr.trim()
  return merchantLabel(tx)
}

/** Outgoing transfers/withdrawals only — not deposits, fees, or credits. */
export function canExportTransactionReceipt(tx: TransactionListItem, isCredit: boolean): boolean {
  if (isCredit) return false
  const t = tx.transaction_type
  if (t === 'FEE' || t === 'DEPOSIT' || t === 'INTEREST' || t === 'LOAN_DISBURSEMENT' || t === 'REVERSAL') {
    return false
  }
  return (
    t === 'WITHDRAWAL' ||
    t === 'TRANSFER_INTERNAL' ||
    t === 'TRANSFER_EXTERNAL' ||
    t === 'TRANSFER_INTERNATIONAL' ||
    t === 'LOAN_PAYMENT'
  )
}

export function isCreditForUser(tx: TransactionListItem, userAccountIds: Set<string>): boolean {
  const to = tx.to_account != null ? String(tx.to_account) : ''
  return Boolean(to && userAccountIds.has(to))
}

/** Only completed transactions change ledger / running balances. */
export function transactionSettlesBalance(status: string): boolean {
  return status === 'COMPLETED'
}

/** Signed amount applied to account balance (0 when pending/failed/flagged). */
export function balanceDeltaForTransaction(tx: TransactionListItem, userAccountIds: Set<string>): number {
  if (!transactionSettlesBalance(tx.status)) return 0
  const amt = parseFloat(tx.amount)
  if (!Number.isFinite(amt)) return 0
  return isCreditForUser(tx, userAccountIds) ? amt : -amt
}

/** Customer-facing labels; API still uses COMPLETED / PENDING / FAILED. */
export function canResumeCompliance(tx: TransactionListItem): boolean {
  const r = tx.compliance_resume
  return Boolean(r?.can_resume && r.session_id && !r.is_expired)
}

export function complianceSessionId(tx: TransactionListItem): string | null {
  return tx.compliance_resume?.session_id ?? tx.regulated_session_id ?? null
}

export function formatTransactionStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Successful'
    case 'FAILED':
      return 'Failed'
    case 'PENDING':
      return 'Pending'
    case 'REVERSED':
      return 'Reversed'
    case 'FLAGGED':
      return 'Flagged'
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
    case 'FAILED':
    case 'FLAGGED':
      return 'bg-red-50 text-red-700 ring-1 ring-red-100'
    case 'REVERSED':
      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
    default:
      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
  }
}
