export {
  DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH,
  DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH,
  DOMESTIC_ACCOUNT_NUMBER_LENGTH,
  isValidDestinationAccountNumber,
  normalizeDestinationAccountNumber,
} from '@/lib/uaeAccount'

export function parseMoneyAmount(raw: string | undefined | null): number | null {
  if (raw == null || !String(raw).trim()) return null
  const n = parseFloat(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** True when amount is a positive number strictly greater than the account balance string. */
export function amountExceedsBalance(amount: string | undefined, balance: string | undefined): boolean {
  const a = parseMoneyAmount(amount)
  const b = parseMoneyAmount(balance)
  if (a == null || b == null || a <= 0) return false
  return a > b
}
