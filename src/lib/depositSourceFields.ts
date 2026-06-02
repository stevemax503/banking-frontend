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
    { key: 'depositor_name', label: 'Depositor name', required: false, placeholder: 'Name as on originating account' },
    { key: 'sender_bank_name', label: 'Originating bank', required: false, placeholder: 'Originating bank name' },
    { key: 'sender_account_number', label: 'Sender account number', required: false, placeholder: 'Account number' },
    { key: 'transfer_reference', label: 'Transfer reference', required: false, placeholder: 'Bank reference (if any)' },
  ],
  CARD: [
    { key: 'cardholder_name', label: 'Cardholder name', required: false },
    { key: 'card_last_four', label: 'Card last 4 digits', required: false, placeholder: 'Last 4 digits' },
    { key: 'card_brand', label: 'Card brand', required: false, placeholder: 'Visa, Mastercard, …' },
    { key: 'authorization_code', label: 'Authorization code', required: false },
  ],
  WIRE: [
    { key: 'originator_name', label: 'Originator name', required: false },
    { key: 'originator_bank', label: 'Originator bank', required: false },
    { key: 'wire_reference', label: 'Wire reference (IMAD/OMAD)', required: false },
    { key: 'beneficiary_reference', label: 'Beneficiary reference', required: false },
  ],
  CASH: [
    { key: 'depositor_name', label: 'Depositor name', required: false },
    {
      key: 'branch_location',
      label: 'Branch / location',
      required: false,
      inputType: 'select',
      options: cashDepositBranchOptions(),
    },
    { key: 'receipt_reference', label: 'Receipt reference', required: false },
  ],
  CHECK: [
    { key: 'payor_name', label: 'Payor name', required: false },
    { key: 'check_number', label: 'Check number', required: false },
    { key: 'drawee_bank', label: 'Drawee bank', required: false },
    { key: 'check_date', label: 'Check date', required: false, placeholder: 'YYYY-MM-DD' },
  ],
  MOBILE: [
    { key: 'payer_name', label: 'Payer name', required: false },
    { key: 'wallet_provider', label: 'Wallet / provider', required: false, placeholder: 'Apple Pay' },
    { key: 'payment_reference', label: 'Payment reference', required: false },
  ],
  OTHER: [
    { key: 'depositor_name', label: 'Depositor / source name', required: false },
    { key: 'source_description', label: 'Source details', required: false },
  ],
}

export function emptyDepositSource(method: DepositMethodKey): Record<string, string> {
  const fields = DEPOSIT_SOURCE_FIELDS[method] ?? []
  return Object.fromEntries(fields.map((f) => [f.key, '']))
}

export function depositSourceComplete(
  _method: DepositMethodKey,
  _source: Record<string, string>,
): boolean {
  return true
}
