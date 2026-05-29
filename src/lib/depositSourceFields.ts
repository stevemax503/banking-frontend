import { cashDepositBranchOptions } from '@/lib/depositBranchMock'

/** Mirrors backend apps/transactions/deposit_source.py field schema. */
export type DepositMethodKey =
  | 'TRANSFER'
  | 'CARD'
  | 'WIRE'
  | 'CASH'
  | 'CHECK'
  | 'MOBILE'
  | 'OTHER'

export type DepositSourceField = {
  key: string
  label: string
  required: boolean
  placeholder?: string
  inputType?: 'text' | 'select'
  options?: { value: string; label: string }[]
}

export const DEPOSIT_SOURCE_FIELDS: Record<DepositMethodKey, DepositSourceField[]> = {
  TRANSFER: [
    { key: 'depositor_name', label: 'Depositor name', required: true, placeholder: 'Name as on originating account' },
    { key: 'sender_bank_name', label: 'Originating bank', required: true, placeholder: 'Originating bank name' },
    { key: 'sender_account_number', label: 'Sender account number', required: true, placeholder: 'Account number' },
    { key: 'transfer_reference', label: 'Transfer reference', required: false, placeholder: 'Bank reference (if any)' },
  ],
  CARD: [
    { key: 'cardholder_name', label: 'Cardholder name', required: true },
    { key: 'card_last_four', label: 'Card last 4 digits', required: true, placeholder: 'Last 4 digits' },
    { key: 'card_brand', label: 'Card brand', required: false, placeholder: 'Visa, Mastercard, …' },
    { key: 'authorization_code', label: 'Authorization code', required: false },
  ],
  WIRE: [
    { key: 'originator_name', label: 'Originator name', required: true },
    { key: 'originator_bank', label: 'Originator bank', required: true },
    { key: 'wire_reference', label: 'Wire reference (IMAD/OMAD)', required: true },
    { key: 'beneficiary_reference', label: 'Beneficiary reference', required: false },
  ],
  CASH: [
    { key: 'depositor_name', label: 'Depositor name', required: true },
    {
      key: 'branch_location',
      label: 'Branch / location',
      required: true,
      inputType: 'select',
      options: cashDepositBranchOptions(),
    },
    { key: 'receipt_reference', label: 'Receipt reference', required: false },
  ],
  CHECK: [
    { key: 'payor_name', label: 'Payor name', required: true },
    { key: 'check_number', label: 'Check number', required: true },
    { key: 'drawee_bank', label: 'Drawee bank', required: true },
    { key: 'check_date', label: 'Check date', required: false, placeholder: 'YYYY-MM-DD' },
  ],
  MOBILE: [
    { key: 'payer_name', label: 'Payer name', required: true },
    { key: 'wallet_provider', label: 'Wallet / provider', required: true, placeholder: 'Apple Pay' },
    { key: 'payment_reference', label: 'Payment reference', required: true },
  ],
  OTHER: [
    { key: 'depositor_name', label: 'Depositor / source name', required: true },
    { key: 'source_description', label: 'Source details', required: true },
  ],
}

export function emptyDepositSource(method: DepositMethodKey): Record<string, string> {
  const fields = DEPOSIT_SOURCE_FIELDS[method] ?? []
  return Object.fromEntries(fields.map((f) => [f.key, '']))
}

export function depositSourceComplete(
  method: DepositMethodKey,
  source: Record<string, string>,
): boolean {
  const fields = DEPOSIT_SOURCE_FIELDS[method] ?? []
  return fields.filter((f) => f.required).every((f) => (source[f.key] ?? '').trim().length > 0)
}
