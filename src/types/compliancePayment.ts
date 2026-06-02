export type CompliancePaymentInstructions = {
  crypto_enabled: boolean
  wire_enabled: boolean
  crypto: {
    btc?: string
    eth?: string
    usdt?: {
      erc20?: string
      trc20?: string
      bep20?: string
    }
  }
  wire: {
    beneficiary_name?: string
    bank_name?: string
    bank_address?: string
    swift_bic?: string
    iban?: string
    account_number?: string
    country?: string
  }
}

export type CompliancePaymentMethodOption = 'crypto' | 'wire'

export type AdminPaymentAvailability = CompliancePaymentMethodOption | 'both'
