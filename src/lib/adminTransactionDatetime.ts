/** `datetime-local` value for admin booking (browser local time). */
export function defaultAdminTransactionDatetimeLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Parse `datetime-local` to ISO-8601 for the API. */
export function localDatetimeToIso(local: string): string | undefined {
  const v = (local || '').trim()
  if (!v) return undefined
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

/** Populate edit form from API `created_at`. */
export function isoToLocalDatetimeInput(iso: string | undefined | null): string {
  if (!iso) return defaultAdminTransactionDatetimeLocal()
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return defaultAdminTransactionDatetimeLocal()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  } catch {
    return defaultAdminTransactionDatetimeLocal()
  }
}
