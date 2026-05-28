/** First useful message from a DRF validation or permission error payload. */
export function adminApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!data) return fallback
  if (typeof data === 'string' && data.trim()) return data
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail
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

/** Normalize optional decimal form fields before POST/PATCH (empty → 0). */
export function decimalFieldOrZero(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '0' : trimmed
}
