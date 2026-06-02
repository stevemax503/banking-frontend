import { z } from 'zod'
import type { InternationalWirePayload } from '@/api/transactions'

export const DELIVERY_METHODS = ['SWIFT'] as const
export const DELIVERY_METHOD_LABEL = 'SWIFT — international wire'
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

export const TRANSFER_CURRENCIES = ['USD', 'EUR', 'GBP'] as const
export type TransferCurrency = (typeof TRANSFER_CURRENCIES)[number]

export const BENEFICIARY_TYPES = ['INDIVIDUAL', 'COMPANY'] as const
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number]

export const ACCOUNT_NUMBER_TYPES = ['IBAN', 'ACCOUNT', 'CLABE', 'UK_SORT', 'US_ROUTING'] as const
export type AccountNumberType = (typeof ACCOUNT_NUMBER_TYPES)[number]

/** Fields used only when `transfer_type === TRANSFER_INTERNATIONAL`. */
export const internationalFieldDefaults = {
  delivery_method: 'SWIFT' as DeliveryMethod,
  transfer_currency: 'USD' as TransferCurrency,
  beneficiary_type: 'INDIVIDUAL' as BeneficiaryType,
  account_number_type: 'IBAN' as AccountNumberType,
  beneficiary_email: '',
  save_beneficiary: false,
  beneficiary_legal_name: '',
  beneficiary_address_line1: '',
  beneficiary_address_line2: '',
  beneficiary_city: '',
  beneficiary_region_state: '',
  beneficiary_postal_code: '',
  beneficiary_country: '',
  beneficiary_bank_name: '',
  beneficiary_bank_address_line1: '',
  beneficiary_bank_address_line2: '',
  beneficiary_bank_city: '',
  beneficiary_bank_country: '',
  beneficiary_bic_swift: '',
  beneficiary_iban: '',
  beneficiary_account_number: '',
  beneficiary_sort_code: '',
  beneficiary_routing_number: '',
  purpose_of_payment: '',
  remittance_reference: '',
  charges_option: 'SHA',
  intermediary_bank_bic: '',
  intermediary_bank_name: '',
  instructions_to_beneficiary_bank: '',
}

export type InternationalFormSlice = typeof internationalFieldDefaults

export type InternationalTransferFormValues = InternationalFormSlice & { amount: string }

/** Zod field definitions shared by the transfer form schema. */
export const internationalZodShape = {
  delivery_method: z.enum(DELIVERY_METHODS),
  transfer_currency: z.enum(TRANSFER_CURRENCIES),
  beneficiary_type: z.enum(BENEFICIARY_TYPES),
  account_number_type: z.enum(ACCOUNT_NUMBER_TYPES),
  beneficiary_email: z.string(),
  save_beneficiary: z.boolean(),
  beneficiary_legal_name: z.string(),
  beneficiary_address_line1: z.string(),
  beneficiary_address_line2: z.string(),
  beneficiary_city: z.string(),
  beneficiary_region_state: z.string(),
  beneficiary_postal_code: z.string(),
  beneficiary_country: z.string(),
  beneficiary_bank_name: z.string(),
  beneficiary_bank_address_line1: z.string(),
  beneficiary_bank_address_line2: z.string(),
  beneficiary_bank_city: z.string(),
  beneficiary_bank_country: z.string(),
  beneficiary_bic_swift: z.string(),
  beneficiary_iban: z.string(),
  beneficiary_account_number: z.string(),
  beneficiary_sort_code: z.string(),
  beneficiary_routing_number: z.string(),
  purpose_of_payment: z.string(),
  remittance_reference: z.string(),
  charges_option: z.string(),
  intermediary_bank_bic: z.string(),
  intermediary_bank_name: z.string(),
  instructions_to_beneficiary_bank: z.string(),
}

const iso2 = (v: string) => /^[A-Z]{2}$/.test(v.trim().toUpperCase())
const bic = (v: string) => /^[A-Z0-9]{8}$|^[A-Z0-9]{11}$/.test(v.replace(/\s/g, '').toUpperCase())
const iban = (v: string) => /^[A-Z0-9]{15,34}$/.test(v.replace(/\s/g, '').toUpperCase())
const postal = (v: string) => {
  const pc = v.trim().toUpperCase()
  return pc.length <= 16 && /^[A-Z0-9]([A-Z0-9 \-]{0,14}[A-Z0-9])?$/.test(pc)
}

export function validateInternationalFields(
  data: InternationalFormSlice & { amount?: string },
  ctx: z.RefinementCtx,
) {
  const req = (key: keyof InternationalFormSlice, label: string, min = 2) => {
    const v = String(data[key] ?? '').trim()
    if (v.length < min) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${label} is required.` })
    }
  }

  const acctType = data.account_number_type

  req('beneficiary_legal_name', 'Beneficiary legal name')
  req('purpose_of_payment', 'Purpose of payment')

  const ref = data.remittance_reference.trim()
  if (ref.length > 0 && ref.length < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['remittance_reference'],
      message: 'Reference must be at least 2 characters when provided.',
    })
  }
  if (ref.length > 35) {
    ctx.addIssue({
      code: 'custom',
      path: ['remittance_reference'],
      message: 'Reference must be at most 35 characters.',
    })
  }

  const co = data.charges_option.trim().toUpperCase()
  if (!['SHA', 'BEN', 'OUR'].includes(co)) {
    ctx.addIssue({
      code: 'custom',
      path: ['charges_option'],
      message: 'Choose SHA, BEN, or OUR.',
    })
  }

  if (!TRANSFER_CURRENCIES.includes(data.transfer_currency as TransferCurrency)) {
    ctx.addIssue({ code: 'custom', path: ['transfer_currency'], message: 'Select a transfer currency.' })
  }

  const email = data.beneficiary_email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ctx.addIssue({ code: 'custom', path: ['beneficiary_email'], message: 'Enter a valid email address.' })
  }

  // SWIFT international wire (MT103-style)
  req('beneficiary_address_line1', 'Street address line 1')
  req('beneficiary_city', 'City / town')
  req('beneficiary_postal_code', 'Postal / ZIP code', 1)
  if (data.beneficiary_postal_code.trim() && !postal(data.beneficiary_postal_code)) {
    ctx.addIssue({
      code: 'custom',
      path: ['beneficiary_postal_code'],
      message: 'Postal / ZIP: letters, digits, spaces or hyphens (max 16).',
    })
  }
  if (!iso2(data.beneficiary_country)) {
    ctx.addIssue({ code: 'custom', path: ['beneficiary_country'], message: 'Beneficiary country (ISO-2) is required.' })
  }

  req('beneficiary_bank_name', 'Bank legal name')
  req('beneficiary_bank_city', 'Bank city')
  if (!iso2(data.beneficiary_bank_country)) {
    ctx.addIssue({ code: 'custom', path: ['beneficiary_bank_country'], message: 'Bank country (ISO-2) is required.' })
  }

  if (!bic(data.beneficiary_bic_swift)) {
    ctx.addIssue({
      code: 'custom',
      path: ['beneficiary_bic_swift'],
      message: 'SWIFT/BIC must be 8 or 11 letters and digits.',
    })
  }

  if (acctType === 'IBAN') {
    if (!iban(data.beneficiary_iban)) {
      ctx.addIssue({ code: 'custom', path: ['beneficiary_iban'], message: 'Enter a valid IBAN.' })
    }
  } else if (acctType === 'UK_SORT') {
    req('beneficiary_sort_code', 'UK sort code', 6)
    const sc = data.beneficiary_sort_code.replace(/\D/g, '')
    if (sc && sc.length !== 6) {
      ctx.addIssue({ code: 'custom', path: ['beneficiary_sort_code'], message: 'Sort code must be 6 digits.' })
    }
    req('beneficiary_account_number', 'Account number', 6)
  } else if (acctType === 'US_ROUTING') {
    req('beneficiary_routing_number', 'Routing number', 9)
    const rt = data.beneficiary_routing_number.replace(/\D/g, '')
    if (rt.length !== 9) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary_routing_number'],
        message: 'Routing number must be 9 digits.',
      })
    }
    req('beneficiary_account_number', 'Account number', 4)
  } else if (acctType === 'CLABE') {
    const clabe = data.beneficiary_account_number.replace(/\D/g, '')
    if (clabe.length !== 18) {
      ctx.addIssue({
        code: 'custom',
        path: ['beneficiary_account_number'],
        message: 'CLABE must be 18 digits.',
      })
    }
  } else {
    req('beneficiary_account_number', 'Account number', 4)
  }

  const optLen = (val: string, max: number, path: keyof InternationalFormSlice, label: string) => {
    if (val.trim().length > max) {
      ctx.addIssue({ code: 'custom', path: [path], message: `${label} must be at most ${max} characters.` })
    }
  }
  optLen(data.beneficiary_address_line2, 140, 'beneficiary_address_line2', 'Address line 2')
  optLen(data.beneficiary_region_state, 80, 'beneficiary_region_state', 'Region / state')
  optLen(data.beneficiary_bank_address_line1, 140, 'beneficiary_bank_address_line1', 'Bank address')
  optLen(data.beneficiary_bank_address_line2, 140, 'beneficiary_bank_address_line2', 'Bank address line 2')
  optLen(data.intermediary_bank_name, 120, 'intermediary_bank_name', 'Intermediary bank name')
  optLen(data.instructions_to_beneficiary_bank, 140, 'instructions_to_beneficiary_bank', 'Instructions')

  const im = data.intermediary_bank_bic.trim()
  if (im && !bic(im)) {
    ctx.addIssue({
      code: 'custom',
      path: ['intermediary_bank_bic'],
      message: 'Intermediary BIC must be 8 or 11 characters.',
    })
  }
}

const INTL_FIELD_LABELS: Partial<Record<keyof InternationalFormSlice, string>> = {
  beneficiary_legal_name: 'Beneficiary legal name',
  purpose_of_payment: 'Purpose of payment',
  beneficiary_address_line1: 'Street address',
  beneficiary_city: 'City / town',
  beneficiary_postal_code: 'Postal / ZIP code',
  beneficiary_country: 'Beneficiary country',
  beneficiary_bank_name: 'Bank legal name',
  beneficiary_bank_city: 'Bank city',
  beneficiary_bank_country: 'Bank country',
  beneficiary_bic_swift: 'SWIFT / BIC',
  beneficiary_iban: 'IBAN',
  beneficiary_account_number: 'Account number',
  beneficiary_sort_code: 'Sort code',
  beneficiary_routing_number: 'Routing number',
  charges_option: 'Charges (SHA / BEN / OUR)',
}

/** When non-null, the international form is incomplete for fee preview. */
export function internationalPreviewIncompleteMessage(
  data: InternationalFormSlice & { amount?: string },
): string | null {
  const issues: Array<{ path: (string | number)[] }> = []
  const ctx = {
    addIssue: (issue: { code: string; path: (string | number)[]; message: string }) => {
      issues.push({ path: issue.path })
    },
  } as z.RefinementCtx
  validateInternationalFields(data, ctx)
  if (issues.length === 0) return null
  const labels = issues
    .map((i) => {
      const key = i.path[0]
      return typeof key === 'string' ? INTL_FIELD_LABELS[key as keyof InternationalFormSlice] : null
    })
    .filter((l): l is string => Boolean(l))
  const unique = [...new Set(labels)]
  if (unique.length === 1) {
    return `Complete ${unique[0]} and other required fields above to see fees and confirm.`
  }
  if (unique.length <= 3) {
    return `Complete required fields above (${unique.join(', ')}) to see fees and confirm.`
  }
  return 'Complete all required international transfer fields above to see fees and confirm.'
}

/** Maps UI form → legacy flat API payload (until backend accepts nested JSON). */
/** Note field for API; falls back to SWIFT purpose when the optional note is empty. */
export function transferDescription(d: {
  description?: string
  purpose_of_payment?: string
  transfer_type?: string
}): string {
  const note = (d.description ?? '').trim()
  if (note) return note
  const purpose = (d.purpose_of_payment ?? '').trim()
  if (purpose) return purpose
  return d.transfer_type === 'TRANSFER_INTERNATIONAL' ? 'International transfer' : 'Transfer'
}

export function buildInternationalDetails(
  d: InternationalFormSlice & { amount?: string },
): InternationalWirePayload {
  const charges = d.charges_option.trim().toUpperCase() as InternationalWirePayload['charges_option']
  let accountId = d.beneficiary_iban.trim()
  if (d.account_number_type === 'UK_SORT') {
    accountId = `SC:${d.beneficiary_sort_code.trim()} AC:${d.beneficiary_account_number.trim()}`
  } else if (d.account_number_type !== 'IBAN') {
    accountId = d.beneficiary_account_number.trim()
    if (d.account_number_type === 'US_ROUTING') {
      accountId = `RT:${d.beneficiary_routing_number.replace(/\D/g, '')} AC:${d.beneficiary_account_number.replace(/\D/g, '')}`
    }
  }

  const out: InternationalWirePayload = {
    beneficiary_legal_name: d.beneficiary_legal_name.trim(),
    beneficiary_address_line1: d.beneficiary_address_line1.trim() || '—',
    beneficiary_city: d.beneficiary_city.trim() || d.beneficiary_bank_city.trim() || '—',
    beneficiary_postal_code: d.beneficiary_postal_code.trim().toUpperCase() || '00000',
    beneficiary_country: (d.beneficiary_country || d.beneficiary_bank_country).trim().toUpperCase(),
    beneficiary_bank_name: d.beneficiary_bank_name.trim(),
    beneficiary_bank_address_line1: d.beneficiary_bank_address_line1.trim() || d.beneficiary_bank_name.trim(),
    beneficiary_bank_city: d.beneficiary_bank_city.trim(),
    beneficiary_bank_country: d.beneficiary_bank_country.trim().toUpperCase(),
    beneficiary_bic_swift: d.beneficiary_bic_swift.trim(),
    beneficiary_iban: accountId,
    purpose_of_payment: d.purpose_of_payment.trim(),
    charges_option: charges,
  }
  const ref = d.remittance_reference.trim()
  if (ref) out.remittance_reference = ref
  const a2 = d.beneficiary_address_line2.trim()
  if (a2) out.beneficiary_address_line2 = a2
  const rs = d.beneficiary_region_state.trim()
  if (rs) out.beneficiary_region_state = rs
  const b2 = d.beneficiary_bank_address_line2.trim()
  if (b2) out.beneficiary_bank_address_line2 = b2
  const imb = d.intermediary_bank_bic.trim()
  if (imb) out.intermediary_bank_bic = imb
  const imn = d.intermediary_bank_name.trim()
  if (imn) out.intermediary_bank_name = imn
  const ins = d.instructions_to_beneficiary_bank.trim()
  if (ins) out.instructions_to_beneficiary_bank = ins
  return out
}

/** Rich nested shape for mock UI / future API. */
export type InternationalTransferPayload = {
  delivery_method: DeliveryMethod
  currency: TransferCurrency
  amount: string
  beneficiary_type: BeneficiaryType
  beneficiary_email?: string
  save_beneficiary: boolean
  beneficiary_name: string
  beneficiary_address: {
    line1: string
    line2?: string
    city: string
    region?: string
    postal_code: string
    country: string
  }
  bank: {
    name: string
    swift_bic?: string
    account_number_type: AccountNumberType
    iban?: string
    account_number?: string
    sort_code?: string
    routing_number?: string
    clabe?: string
    city: string
    country: string
    address_line1?: string
    address_line2?: string
  }
  payment: {
    purpose: string
    reference: string
    charge_option: 'SHA' | 'BEN' | 'OUR'
  }
  advanced?: {
    intermediary_bank_name?: string
    intermediary_bic?: string
    instructions?: string
  }
}

export function buildInternationalTransferPayload(
  d: InternationalFormSlice & { amount: string },
): InternationalTransferPayload {
  const bank: InternationalTransferPayload['bank'] = {
    name: d.beneficiary_bank_name.trim(),
    account_number_type: d.account_number_type,
    city: d.beneficiary_bank_city.trim(),
    country: d.beneficiary_bank_country.trim().toUpperCase(),
  }
  if (d.beneficiary_bic_swift.trim()) bank.swift_bic = d.beneficiary_bic_swift.trim()
  if (d.beneficiary_bank_address_line1.trim()) bank.address_line1 = d.beneficiary_bank_address_line1.trim()
  if (d.beneficiary_bank_address_line2.trim()) bank.address_line2 = d.beneficiary_bank_address_line2.trim()

  if (d.account_number_type === 'IBAN') bank.iban = d.beneficiary_iban.trim()
  else if (d.account_number_type === 'CLABE') bank.clabe = d.beneficiary_account_number.replace(/\D/g, '')
  else if (d.account_number_type === 'UK_SORT') {
    bank.sort_code = d.beneficiary_sort_code.replace(/\D/g, '')
    bank.account_number = d.beneficiary_account_number.trim()
  } else if (d.account_number_type === 'US_ROUTING') {
    bank.routing_number = d.beneficiary_routing_number.replace(/\D/g, '')
    bank.account_number = d.beneficiary_account_number.replace(/\D/g, '')
  } else bank.account_number = d.beneficiary_account_number.trim()

  const advanced: InternationalTransferPayload['advanced'] = {}
  if (d.intermediary_bank_name.trim()) advanced.intermediary_bank_name = d.intermediary_bank_name.trim()
  if (d.intermediary_bank_bic.trim()) advanced.intermediary_bic = d.intermediary_bank_bic.trim()
  if (d.instructions_to_beneficiary_bank.trim()) advanced.instructions = d.instructions_to_beneficiary_bank.trim()

  return {
    delivery_method: d.delivery_method,
    currency: d.transfer_currency,
    amount: d.amount,
    beneficiary_type: d.beneficiary_type,
    ...(d.beneficiary_email.trim() ? { beneficiary_email: d.beneficiary_email.trim() } : {}),
    save_beneficiary: d.save_beneficiary,
    beneficiary_name: d.beneficiary_legal_name.trim(),
    beneficiary_address: {
      line1: d.beneficiary_address_line1.trim(),
      ...(d.beneficiary_address_line2.trim() ? { line2: d.beneficiary_address_line2.trim() } : {}),
      city: d.beneficiary_city.trim(),
      ...(d.beneficiary_region_state.trim() ? { region: d.beneficiary_region_state.trim() } : {}),
      postal_code: d.beneficiary_postal_code.trim(),
      country: d.beneficiary_country.trim().toUpperCase(),
    },
    bank,
    payment: {
      purpose: d.purpose_of_payment.trim(),
      reference: d.remittance_reference.trim(),
      charge_option: d.charges_option.trim().toUpperCase() as 'SHA' | 'BEN' | 'OUR',
    },
    ...(Object.keys(advanced).length ? { advanced } : {}),
  }
}

const FX_RATES: Record<TransferCurrency, Partial<Record<TransferCurrency, number>>> = {
  USD: { EUR: 0.915, GBP: 0.79 },
  EUR: { USD: 1.09, GBP: 0.86 },
  GBP: { USD: 1.27, EUR: 1.16 },
}

export function mockIndicativeExchangeRate(from: TransferCurrency, to: TransferCurrency): number {
  if (from === to) return 1
  return FX_RATES[from]?.[to] ?? 1
}

export function generateMockUetr(): string {
  return `${crypto.randomUUID()}`.replace(/-/g, '').slice(0, 32).toUpperCase()
}
