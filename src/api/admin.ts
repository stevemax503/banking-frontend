import { apiClient } from './client'

export const adminApi = {
  dashboard: () => apiClient.get('/api/admin-portal/dashboard/'),

  // Users
  users: (params?: Record<string, string>) => apiClient.get('/api/admin-portal/users/', { params }),
  userDetail: (id: string) => apiClient.get(`/api/admin-portal/users/${id}/`),
  updateUser: (id: string, data: Record<string, unknown>) => apiClient.patch(`/api/admin-portal/users/${id}/`, data),
  deleteUser: (id: string) => apiClient.delete(`/api/admin-portal/users/${id}/`),
  createStaffUser: (data: {
    email: string
    full_name: string
    phone?: string
    password: string
    password_confirm: string
    role: string
    admin_account_scope?: 'ALL' | 'SELECTED'
    assigned_customer_ids?: string[]
  }) => apiClient.post('/api/admin-portal/users/create-staff/', data),
  changeUserRole: (id: string, role: string) => apiClient.post(`/api/admin-portal/users/${id}/role/`, { role }),
  toggleUserLock: (id: string) => apiClient.post(`/api/admin-portal/users/${id}/lock/`),
  approveKYC: (id: string, decision: 'APPROVED' | 'REJECTED') =>
    apiClient.post(`/api/admin-portal/users/${id}/kyc/`, { decision }),
  issueLoginOtp: (userId: string, sendEmail = true) =>
    apiClient.post(`/api/admin-portal/users/${userId}/issue-login-otp/`, { send_email: sendEmail }),
  impersonateCustomer: (userId: string) =>
    apiClient.post<{ access: string; refresh: string; user: Record<string, unknown> }>(
      `/api/admin-portal/users/${userId}/impersonate/`,
    ),
  setUserPassword: (
    userId: string,
    data: { new_password: string; new_password_confirm: string; send_email?: boolean },
  ) => apiClient.post(`/api/admin-portal/users/${userId}/set-password/`, data),
  sendPasswordReset: (userId: string) =>
    apiClient.post(`/api/admin-portal/users/${userId}/send-password-reset/`),

  emailOtps: (params?: Record<string, string>) =>
    apiClient.get('/api/admin-portal/email-otps/', { params }),

  // Accounts
  accounts: (params?: Record<string, string>) => apiClient.get('/api/admin-portal/accounts/', { params }),
  accountStatus: (id: string, status: string) =>
    apiClient.post(`/api/admin-portal/accounts/${id}/status/`, { status }),
  adjustBalance: (id: string, data: { operation: string; amount: string; note: string }) =>
    apiClient.post(`/api/admin-portal/accounts/${id}/adjust/`, data),
  accountDebit: (
    id: string,
    data: {
      amount: string
      transfer_type: string
      description?: string
      status?: string
      transaction_at?: string
      to_account_id?: string
      beneficiary_name?: string
      bank_name?: string
      account_number?: string
      international_details?: Record<string, string>
    },
  ) => apiClient.post(`/api/admin-portal/accounts/${id}/debit/`, data),
  depositPreview: (amount: string) =>
    apiClient.get('/api/admin-portal/deposit-preview/', { params: { amount } }),
  accountDeposit: (
    id: string,
    data: {
      amount: string
      description?: string
      deposit_method: string
      deposit_source?: Record<string, string>
      status?: string
      transaction_at?: string
    },
  ) => apiClient.post(`/api/admin-portal/accounts/${id}/deposit/`, data),

  // Transactions
  transactions: (params?: Record<string, string>) => apiClient.get('/api/admin-portal/transactions/', { params }),
  updateTransaction: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/api/admin-portal/transactions/${id}/update/`, data),
  deleteTransaction: (id: string) => apiClient.delete(`/api/admin-portal/transactions/${id}/delete/`),
  bulkDeleteTransactions: (ids: string[]) =>
    apiClient.post('/api/admin-portal/transactions/bulk-delete/', { ids }),
  reverseTransaction: (id: string) => apiClient.post(`/api/admin-portal/transactions/${id}/reverse/`),
  flagTransaction: (id: string) => apiClient.post(`/api/admin-portal/transactions/${id}/flag/`),

  // Loans
  loans: (params?: Record<string, string>) => apiClient.get('/api/admin-portal/loans/', { params }),
  reviewLoan: (id: string, decision: string, notes?: string) =>
    apiClient.post(`/api/admin-portal/loans/${id}/review/`, { decision, notes }),
  disburseLoan: (id: string, account_id: string) =>
    apiClient.post(`/api/admin-portal/loans/${id}/disburse/`, { disbursement_account_id: account_id }),
  loanProducts: () => apiClient.get('/api/admin-portal/loan-products/'),
  createLoanProduct: (data: FormData) => apiClient.post('/api/admin-portal/loan-products/', data),
  updateLoanProduct: (id: string, data: FormData) =>
    apiClient.patch(`/api/admin-portal/loan-products/${id}/`, data),
  deleteLoanProduct: (id: string) => apiClient.delete(`/api/admin-portal/loan-products/${id}/`),
  downloadLoanApplicationForm: (userId?: string) =>
    apiClient.get('/api/admin-portal/loan-application-form/pdf/', {
      params: userId ? { user_id: userId } : undefined,
      responseType: 'blob',
    }),
  sendLoanApplicationForm: (data: { email?: string; user_id?: string; loan_id?: string }) =>
    apiClient.post('/api/admin-portal/loan-application-form/send/', data),

  // Card products (issuance fee + monthly cap per account type)
  cardProducts: () => apiClient.get('/api/admin-portal/card-products/'),
  updateCardProduct: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/api/admin-portal/card-products/${id}/`, data),

  // Fees
  fees: () => apiClient.get('/api/admin-portal/fees/'),
  createFee: (data: Record<string, unknown>) => apiClient.post('/api/admin-portal/fees/', data),
  updateFee: (id: number, data: Record<string, unknown>) => apiClient.patch(`/api/admin-portal/fees/${id}/`, data),
  complianceFeeLines: (params?: Record<string, string>) =>
    apiClient.get('/api/admin-portal/compliance-fee-lines/', { params }),
  createComplianceFeeLine: (data: Record<string, unknown>) => apiClient.post('/api/admin-portal/compliance-fee-lines/', data),
  updateComplianceFeeLine: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/api/admin-portal/compliance-fee-lines/${id}/`, data),
  deleteComplianceFeeLine: (id: string) => apiClient.delete(`/api/admin-portal/compliance-fee-lines/${id}/`),
  pendingComplianceSessions: () => apiClient.get('/api/admin-portal/pending-compliance-sessions/'),
  deletePendingComplianceSession: (sessionId: string) =>
    apiClient.delete(`/api/admin-portal/pending-compliance-sessions/${sessionId}/`),
  adminRegulatedLineConfirmPayment: (sessionId: string, lineId: string) =>
    apiClient.post(
      `/api/admin-portal/pending-compliance-sessions/${sessionId}/lines/${lineId}/confirm-payment/`,
    ),
  adminRegulatedLineChargeSendOtp: (sessionId: string, lineId: string) =>
    apiClient.post(
      `/api/admin-portal/pending-compliance-sessions/${sessionId}/lines/${lineId}/charge-send-otp/`,
    ),
  adminRegulatedLineAllowCustomerCharge: (sessionId: string, lineId: string) =>
    apiClient.post(
      `/api/admin-portal/pending-compliance-sessions/${sessionId}/lines/${lineId}/allow-customer-charge/`,
    ),
  exchangeRates: () => apiClient.get('/api/admin-portal/exchange-rates/'),
  updateRate: (id: number, data: Record<string, unknown>) =>
    apiClient.patch(`/api/admin-portal/exchange-rates/${id}/`, data),

  // Bill payment management fees (per service/biller + default)
  paymentFeeSettings: () => apiClient.get('/api/admin-portal/payment-fees/settings/'),
  updatePaymentFeeSettings: (data: { default_management_fee: string }) =>
    apiClient.patch('/api/admin-portal/payment-fees/settings/', data),
  paymentFeeOverrides: () => apiClient.get('/api/admin-portal/payment-fees/overrides/'),
  upsertPaymentFeeOverride: (data: {
    service_id: string
    biller_id: string
    management_fee: string
    biller_label?: string
  }) => apiClient.post('/api/admin-portal/payment-fees/overrides/', data),
  deletePaymentFeeOverride: (id: string) => apiClient.delete(`/api/admin-portal/payment-fees/overrides/${id}/`),

  // Tickets
  tickets: (params?: Record<string, string>) => apiClient.get('/api/admin-portal/tickets/', { params }),
  ticketReply: (id: string, body: string, is_internal_note?: boolean) =>
    apiClient.post(`/api/admin-portal/tickets/${id}/reply/`, { body, is_internal_note }),
  updateTicketStatus: (id: string, status: string) =>
    apiClient.patch(`/api/admin-portal/tickets/${id}/status/`, { status }),

  // Audit
  auditLogs: (params?: Record<string, string | undefined>) =>
    apiClient.get('/api/admin-portal/audit-logs/', {
      params: Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v != null && v !== '')),
    }),

  profileChangeRequests: (params?: Record<string, string>) =>
    apiClient.get('/api/admin-portal/profile-change-requests/', { params }),
  approveProfileChangeRequest: (id: string) =>
    apiClient.post(`/api/admin-portal/profile-change-requests/${id}/approve/`),
  rejectProfileChangeRequest: (id: string, reason?: string) =>
    apiClient.post(`/api/admin-portal/profile-change-requests/${id}/reject/`, { reason: reason ?? '' }),
}
