import { apiClient } from './client'

/**
 * International wire payload — aligned with SWIFT MT103-style creditor / creditor-agent / 71A / remittance data.
 * Keys match backend `validate_and_normalize_international_details`.
 */
export type InternationalWirePayload = {
  beneficiary_legal_name: string
  beneficiary_address_line1: string
  beneficiary_city: string
  beneficiary_postal_code: string
  beneficiary_country: string
  beneficiary_address_line2?: string
  beneficiary_region_state?: string
  beneficiary_bank_name: string
  beneficiary_bank_address_line1: string
  beneficiary_bank_city: string
  beneficiary_bank_country: string
  beneficiary_bank_address_line2?: string
  beneficiary_bic_swift: string
  beneficiary_iban: string
  purpose_of_payment: string
  remittance_reference?: string
  charges_option: 'SHA' | 'BEN' | 'OUR'
  intermediary_bank_bic?: string
  intermediary_bank_name?: string
  instructions_to_beneficiary_bank?: string
}

export const transactionsApi = {
  list: (params?: Record<string, string | number>) => apiClient.get('/api/transactions/', { params }),
  detail: (id: string) => apiClient.get(`/api/transactions/${id}/`),
  deposit: (data: { account_id: string; amount: string; description?: string; idempotency_key?: string }) =>
    apiClient.post('/api/transactions/deposit/', data),
  withdraw: (data: { account_id: string; amount: string; description?: string; idempotency_key?: string }) =>
    apiClient.post('/api/transactions/withdraw/', data),
  transfer: (data: {
    from_account_id: string
    to_account_id: string
    amount: string
    description?: string
    transfer_type?: string
    account_holder_name?: string
    external_bank_name?: string
    idempotency_key?: string
    otp?: string
    regulated_session_id?: string
    international_details?: InternationalWirePayload
  }) => apiClient.post('/api/transactions/transfer/', data),
  transferPreview: (data: {
    from_account_id: string
    to_account_id: string
    amount: string
    transfer_type?: string
    international_details?: InternationalWirePayload
  }) => apiClient.post('/api/transactions/transfer/preview/', data),
  transferSendOtp: (data: {
    from_account_id: string
    to_account_id: string
    amount: string
    transfer_type?: string
    international_details?: InternationalWirePayload
  }) => apiClient.post('/api/transactions/transfer/send-otp/', data),
  regulatedIntlSessionStart: (data: {
    from_account_id: string
    to_account_id: string
    amount: string
    transfer_type?: string
    description?: string
    idempotency_key?: string
    transfer_otp: string
    international_details?: InternationalWirePayload
  }) => apiClient.post('/api/transactions/regulated-sessions/intl/start/', data),
  regulatedSessionDetail: (sessionId: string) => apiClient.get(`/api/transactions/regulated-sessions/${sessionId}/`),
  regulatedLineSubmitPayment: (sessionId: string, lineId: string, paymentProof?: File) => {
    if (paymentProof) {
      const formData = new FormData()
      formData.append('payment_proof', paymentProof)
      return apiClient.post(
        `/api/transactions/regulated-sessions/${sessionId}/lines/${lineId}/submit-payment/`,
        formData,
      )
    }
    return apiClient.post(`/api/transactions/regulated-sessions/${sessionId}/lines/${lineId}/submit-payment/`)
  },
  regulatedLineChargeSendOtp: (sessionId: string, lineId: string) =>
    apiClient.post(`/api/transactions/regulated-sessions/${sessionId}/lines/${lineId}/charge-send-otp/`),
  regulatedLineVerifyOtp: (sessionId: string, lineId: string, otp: string) =>
    apiClient.post(`/api/transactions/regulated-sessions/${sessionId}/lines/${lineId}/verify-otp/`, { otp }),
  regulatedSessionCompleteTransfer: (sessionId: string) =>
    apiClient.post(`/api/transactions/regulated-sessions/${sessionId}/complete-transfer/`),
  fees: () => apiClient.get('/api/transactions/fees/'),
  exchangeRates: () => apiClient.get('/api/transactions/exchange-rates/'),
}
