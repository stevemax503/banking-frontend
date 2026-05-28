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

/** Normalize optional decimal form fields before POST/PATCH (empty → 0). */
export function decimalFieldOrZero(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '0' : trimmed
}

/** Build compliance fee POST body (omit `user` for global lines). */
export function buildComplianceFeePayload(fields: {
  scope: 'global' | 'user'
  user_id: string
  name: string
  code: string
  applies_to: string
  min_principal_threshold: string
  flat_amount: string
  percentage: string
  min_amount: string
  max_amount: string
  is_active: boolean
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: fields.name.trim(),
    code: fields.code,
    applies_to: fields.applies_to,
    min_principal_threshold: decimalFieldOrZero(fields.min_principal_threshold),
    flat_amount: decimalFieldOrZero(fields.flat_amount),
    percentage: fields.percentage,
    min_amount: decimalFieldOrZero(fields.min_amount),
    max_amount: decimalFieldOrZero(fields.max_amount),
    is_active: fields.is_active,
  }
  if (fields.scope === 'user' && fields.user_id) {
    payload.user = fields.user_id
  }
  return payload
}
