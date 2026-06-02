import type { TransactionListItem } from '@/utils/transactionDisplay'
import {
  buildInternationalDetails,
  transferDescription,
  type InternationalFormSlice,
} from '@/pages/transactions/internationalTransfer'
import { normalizeDestinationAccountNumber } from '@/pages/transactions/transferValidation'

type TransferFormSlice = InternationalFormSlice & {
  transfer_type: string
  amount: string
  account_id: string
  to_account_id: string
  account_holder_name: string
  external_bank_name: string
}

export function asTransactionListItem(data: unknown): TransactionListItem | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.id !== 'string') return null

  return {
    id: d.id,
    reference_number: typeof d.reference_number === 'string' ? d.reference_number : '',
    transaction_type: typeof d.transaction_type === 'string' ? d.transaction_type : 'TRANSFER_INTERNAL',
    amount: String(d.amount ?? '0'),
    currency: typeof d.currency === 'string' ? d.currency : 'USD',
    description: typeof d.description === 'string' ? d.description : '',
    status: typeof d.status === 'string' ? d.status : 'COMPLETED',
    created_at: typeof d.created_at === 'string' ? d.created_at : new Date().toISOString(),
    completed_at:
      typeof d.completed_at === 'string' ? d.completed_at : d.completed_at === null ? null : new Date().toISOString(),
    from_account: d.from_account != null ? String(d.from_account) : null,
    to_account: d.to_account != null ? String(d.to_account) : null,
    from_account_number: d.from_account_number != null ? String(d.from_account_number) : null,
    to_account_number: d.to_account_number != null ? String(d.to_account_number) : null,
    regulated_session_id: d.regulated_session_id != null ? String(d.regulated_session_id) : null,
    compliance_resume: (d.compliance_resume as TransactionListItem['compliance_resume']) ?? null,
    metadata: (d.metadata as Record<string, unknown>) ?? null,
  }
}

/** Build a receipt-ready transaction when the API returns only partial data (e.g. demo mode). */
export function buildTransferReceiptFromForm(
  data: TransferFormSlice,
  fromAccount: { account_number: string } | undefined,
  overrides?: Partial<TransactionListItem>,
): TransactionListItem {
  const isIntl = data.transfer_type === 'TRANSFER_INTERNATIONAL'
  const intl = isIntl ? buildInternationalDetails(data) : null
  const toAccountNumber = isIntl
    ? intl?.beneficiary_iban ?? ''
    : normalizeDestinationAccountNumber(data.to_account_id || '')

  const metadata: Record<string, unknown> = isIntl && intl
    ? {
        international_wire: intl,
        recipient_account_holder_name: intl.beneficiary_legal_name,
        destination_account_number: intl.beneficiary_iban,
      }
    : {
        recipient_account_holder_name: (data.account_holder_name || '').trim(),
        external_bank_name: (data.external_bank_name || '').trim(),
        destination_account_number: toAccountNumber,
      }

  const base: TransactionListItem = {
    id: overrides?.id ?? crypto.randomUUID(),
    reference_number: overrides?.reference_number ?? '',
    transaction_type: data.transfer_type,
    amount: data.amount,
    currency: (data.transfer_currency as string) || 'USD',
    description: transferDescription(data),
    status: 'COMPLETED',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    from_account: data.account_id || null,
    to_account: null,
    from_account_number: fromAccount?.account_number ?? null,
    to_account_number: toAccountNumber || null,
    metadata,
  }

  return { ...base, ...overrides }
}
