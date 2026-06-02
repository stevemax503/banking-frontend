/** First useful message from a DRF validation or permission error payload. */
export function adminApiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; data?: unknown } })?.response
  const data = response?.data
  const status = response?.status

  if (typeof data === 'string' && data.trim()) {
    if (isHtmlErrorBody(data)) {
      if (status === 500) {
        return 'Server error while saving. The change may still have been applied — refresh the list. If it keeps failing, run a full backend deploy (pull + migrate + restart).'
      }
      if (status && status >= 500) {
        return `Server error (${status}). Try again or contact support if this continues.`
      }
      return fallback
    }
    return data.length > 280 ? `${data.slice(0, 280)}…` : data
  }

  if (!data) return fallback
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === 'string' && obj.detail.trim()) {
      if (isHtmlErrorBody(obj.detail)) return fallback
      return obj.detail
    }
    const parts: string[] = []
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'detail') continue
      if (Array.isArray(value)) {
        parts.push(`${key}: ${value.map(String).join(', ')}`)
      } else if (typeof value === 'string') {
        parts.push(value)
      }
    }
    if (parts.length) return parts.join(' · ')
  }
  return fallback
}

function isHtmlErrorBody(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<h1>server error')
}

import { complianceMessageForSave } from '@/constants/compliance'

/** Normalize optional decimal form fields before POST/PATCH (empty → 0). */
export function decimalFieldOrZero(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '0' : trimmed
}

/** Build compliance fee POST body (omit `user` for global lines). Hidden fields default to 0. */
export function buildComplianceFeePayload(fields: {
  scope: 'global' | 'user'
  user_id: string
  name: string
  customer_message: string
  code: string
  applies_to: string
  flat_amount: string
  percentage: string
  is_active: boolean
  payment_crypto_enabled: boolean
  payment_wire_enabled: boolean
  wire_beneficiary_name: string
  wire_bank_name: string
  wire_bank_address: string
  wire_swift_bic: string
  wire_iban: string
  wire_account_number: string
  wire_country: string
  custom_payment_reference: string
  crypto_btc_address: string
  crypto_eth_address: string
  crypto_usdt_erc20: string
  crypto_usdt_trc20: string
  crypto_usdt_bep20: string
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    customer_message: complianceMessageForSave(fields.customer_message),
    code: fields.code,
    applies_to: fields.applies_to,
    min_principal_threshold: '0',
    flat_amount: decimalFieldOrZero(fields.flat_amount),
    percentage: fields.percentage,
    min_amount: '0',
    max_amount: '0',
    is_active: fields.is_active,
    payment_crypto_enabled: fields.payment_crypto_enabled,
    payment_wire_enabled: fields.payment_wire_enabled,
    wire_beneficiary_name: fields.wire_beneficiary_name.trim(),
    wire_bank_name: fields.wire_bank_name.trim(),
    wire_bank_address: fields.wire_bank_address.trim(),
    wire_swift_bic: fields.wire_swift_bic.trim(),
    wire_iban: fields.wire_iban.trim(),
    wire_account_number: fields.wire_account_number.trim(),
    wire_country: fields.wire_country.trim(),
    custom_payment_reference: fields.custom_payment_reference.trim(),
    crypto_btc_address: fields.crypto_btc_address.trim(),
    crypto_eth_address: fields.crypto_eth_address.trim(),
    crypto_usdt_erc20: fields.crypto_usdt_erc20.trim(),
    crypto_usdt_trc20: fields.crypto_usdt_trc20.trim(),
    crypto_usdt_bep20: fields.crypto_usdt_bep20.trim(),
  }
  if (fields.scope === 'user' && fields.user_id) {
    payload.user = fields.user_id
  }
  return payload
}
