/** UAE IBAN and domestic account number (11–16 digits). */

export const DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH = 11
export const DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH = 16
export const DOMESTIC_ACCOUNT_NUMBER_LENGTH = DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH

export const UAE_IBAN_MIN_LENGTH = 18
export const UAE_IBAN_MAX_LENGTH = 23

const UAE_IBAN_RE = /^AE\d{16,21}$/

export type AccountIdentifier = {
  account_number: string
  iban?: string | null
}

export function compactUaeAccountInput(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase()
}

export function isValidDomesticAccountNumber(digits: string): boolean {
  return /^\d+$/.test(digits) && digits.length >= DOMESTIC_ACCOUNT_NUMBER_MIN_LENGTH && digits.length <= DOMESTIC_ACCOUNT_NUMBER_MAX_LENGTH
}

export function isValidUaeIban(raw: string): boolean {
  return UAE_IBAN_RE.test(compactUaeAccountInput(raw))
}

export function extractDomesticFromUaeIban(iban: string): string {
  const compact = compactUaeAccountInput(iban)
  if (!isValidUaeIban(compact)) {
    throw new Error('Invalid UAE IBAN')
  }
  return compact.slice(7)
}

/** Domestic account from IBAN or digit-only input (may be invalid length). */
export function normalizeDestinationAccountNumber(raw: string): string {
  const compact = compactUaeAccountInput(raw)
  if (!compact) return ''
  if (compact.startsWith('AE')) {
    if (isValidUaeIban(compact)) return extractDomesticFromUaeIban(compact)
    return ''
  }
  return compact.replace(/\D/g, '')
}

export function isValidDestinationAccountNumber(raw: string): boolean {
  const compact = compactUaeAccountInput(raw)
  if (!compact) return false
  if (compact.startsWith('AE')) return isValidUaeIban(compact)
  const digits = normalizeDestinationAccountNumber(raw)
  return isValidDomesticAccountNumber(digits)
}

/** Display UAE IBAN in groups of four. */
export function formatUaeIban(iban: string | null | undefined): string {
  const compact = compactUaeAccountInput(iban || '')
  if (!compact) return '—'
  if (!compact.startsWith('AE')) return compact
  const parts: string[] = []
  for (let i = 0; i < compact.length; i += 4) {
    parts.push(compact.slice(i, i + 4))
  }
  return parts.join(' ')
}

export function formatDomesticAccountNumber(num: string | null | undefined): string {
  const digits = (num || '').replace(/\D/g, '')
  if (!digits) return '—'
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

/** Primary display: IBAN when stored, otherwise grouped domestic number. */
export function formatAccountIdentifierDisplay(account: AccountIdentifier): string {
  if (account.iban) return formatUaeIban(account.iban)
  return formatDomesticAccountNumber(account.account_number)
}

export function accountIdentifierLastFour(account: AccountIdentifier): string {
  const compact = account.iban
    ? compactUaeAccountInput(account.iban)
    : (account.account_number || '').replace(/\D/g, '')
  return compact.slice(-4) || '0000'
}

export function maskAccountIdentifier(account: AccountIdentifier): string {
  const last4 = accountIdentifierLastFour(account)
  return `···· ${last4}`
}

/** Clipboard / API payload: compact IBAN when available. */
export function copyableAccountIdentifier(account: AccountIdentifier): string {
  if (account.iban) return compactUaeAccountInput(account.iban)
  return (account.account_number || '').replace(/\D/g, '')
}
