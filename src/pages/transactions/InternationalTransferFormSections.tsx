import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { Input } from '@/components/forms/Input'
import { LocationCombobox } from '@/components/forms/LocationCombobox'
import { selectShell, StyledSelect } from '@/components/forms/StyledSelect'
import { cn } from '@/utils/cn'
import {
  useCityOptions,
  useCountryComboboxFormatter,
  useCountryOptions,
  useLocationDataset,
  useStateOptions,
} from '@/lib/locationData'
import {
  ACCOUNT_NUMBER_TYPES,
  DELIVERY_METHOD_LABEL,
  type InternationalTransferFormValues,
  mockIndicativeExchangeRate,
  TRANSFER_CURRENCIES,
} from './internationalTransfer'

type Props = {
  register: UseFormRegister<InternationalTransferFormValues>
  setValue: UseFormSetValue<InternationalTransferFormValues>
  errors: FieldErrors<InternationalTransferFormValues>
  watch: UseFormWatch<InternationalTransferFormValues>
  /** Shown on step 1 when amount/currency entered (mock indicative). */
  showIndicativePricing?: boolean
  estimatedFeeLabel?: string
  exchangeRateLabel?: string
  /** Real-time balance check (e.g. insufficient funds). */
  amountBalanceError?: string
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="border-b border-emerald-200/70 pb-2">
      <p className="text-xs font-semibold text-emerald-950">{children}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-900/75">{hint}</p> : null}
    </div>
  )
}

export default function InternationalTransferFormSections({
  register,
  setValue,
  errors,
  watch: w,
  showIndicativePricing = false,
  estimatedFeeLabel,
  exchangeRateLabel,
  amountBalanceError,
}: Props) {
  const { data: csc, isLoading: locationLoading } = useLocationDataset()
  const beneficiaryCountry = w('beneficiary_country')
  const beneficiaryState = w('beneficiary_region_state')
  const bankCountry = w('beneficiary_bank_country')
  const countryOptions = useCountryOptions(csc)
  const formatCountry = useCountryComboboxFormatter(csc)
  const stateOptions = useStateOptions(csc, beneficiaryCountry)
  const cityOptions = useCityOptions(csc, beneficiaryCountry, beneficiaryState, stateOptions)
  const bankCityOptions = useCityOptions(csc, bankCountry, '', [])
  const acctType = w('account_number_type')
  const sendCurrency = w('transfer_currency')
  const amount = w('amount')

  const indicativeRate =
    showIndicativePricing && amount && /^\d+(\.\d{1,2})?$/.test(amount)
      ? mockIndicativeExchangeRate(
          sendCurrency as (typeof TRANSFER_CURRENCIES)[number],
          sendCurrency === 'USD' ? 'EUR' : 'USD',
        )
      : null

  const additionalDetailFields = [
    'beneficiary_address_line2',
    'beneficiary_region_state',
    'beneficiary_bank_address_line1',
    'intermediary_bank_name',
    'intermediary_bank_bic',
    'instructions_to_beneficiary_bank',
  ] as const
  const hasAdditionalErrors = additionalDetailFields.some((key) => errors[key]?.message)
  const [additionalOpen, setAdditionalOpen] = useState(false)

  useEffect(() => {
    if (hasAdditionalErrors) setAdditionalOpen(true)
  }, [hasAdditionalErrors])

  return (
    <div className="space-y-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
          International transfer
        </p>
        <p className="mt-1 text-sm leading-relaxed text-emerald-950/85">
          Beneficiary and bank details for your international payment. Expand Additional details only if your bank requires extra fields.
        </p>
      </div>

      {/* Transfer details */}
      <div className="space-y-3">
        <SectionTitle hint="Amount, currency, and SWIFT routing.">
          Transfer details
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery method</span>
            <div className={`${selectShell} px-4 py-3 text-sm font-medium text-emerald-950`}>
              {DELIVERY_METHOD_LABEL}
            </div>
            <input type="hidden" value="SWIFT" {...register('delivery_method')} />
          </div>
          <StyledSelect
            label="Transfer currency"
            error={errors.transfer_currency?.message}
            {...register('transfer_currency')}
          >
            {TRANSFER_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </StyledSelect>
          <Input
            label="Amount"
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0.01"
            error={amountBalanceError || errors.amount?.message}
            {...register('amount')}
          />
          <div className="sm:col-span-2">
            <Input
              label="Purpose of payment"
              placeholder="Narrative for the beneficiary bank and compliance"
              error={errors.purpose_of_payment?.message}
              {...register('purpose_of_payment')}
            />
          </div>
        </div>
        {showIndicativePricing && amount && indicativeRate != null ? (
          <div className="grid gap-2 rounded-xl border border-emerald-200/60 bg-white/60 px-3 py-2.5 text-xs text-emerald-950 sm:grid-cols-2">
            <div>
              <span className="text-emerald-800/80">Indicative exchange rate</span>
              <p className="font-mono font-semibold tabular-nums">
                {exchangeRateLabel ?? `1 ${sendCurrency} ≈ ${indicativeRate} (demo)`}
              </p>
            </div>
            {estimatedFeeLabel ? (
              <div>
                <span className="text-emerald-800/80">Estimated fees</span>
                <p className="font-semibold tabular-nums">{estimatedFeeLabel}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Beneficiary */}
      <div className="space-y-3">
        <SectionTitle>Beneficiary information</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <StyledSelect label="Beneficiary type" className="sm:col-span-2" {...register('beneficiary_type')}>
            <option value="INDIVIDUAL">Individual</option>
            <option value="COMPANY">Company</option>
          </StyledSelect>
          <div className="sm:col-span-2">
            <Input
              label="Legal name (as on account)"
              placeholder="Individual or registered company name"
              error={errors.beneficiary_legal_name?.message}
              {...register('beneficiary_legal_name')}
            />
          </div>
          <>
              <div className="sm:col-span-2">
                <Input
                  label="Street address line 1"
                  placeholder="Street, building, suite"
                  error={errors.beneficiary_address_line1?.message}
                  {...register('beneficiary_address_line1')}
                />
              </div>
              <LocationCombobox
                label="Country"
                value={beneficiaryCountry}
                onChange={(iso) => {
                  setValue('beneficiary_country', iso, { shouldValidate: true })
                  setValue('beneficiary_region_state', '')
                  setValue('beneficiary_city', '')
                }}
                options={countryOptions}
                loading={locationLoading}
                selectOnly
                formatCommitted={formatCountry}
                placeholder="Search country"
                hint="Type to filter the list, then select a country"
                error={errors.beneficiary_country?.message}
              />
              <LocationCombobox
                label="Region / state (optional)"
                value={beneficiaryState}
                onChange={(v) => {
                  setValue('beneficiary_region_state', v, { shouldValidate: true })
                  setValue('beneficiary_city', '')
                }}
                options={stateOptions}
                loading={locationLoading}
                disabled={!beneficiaryCountry.trim()}
                placeholder={beneficiaryCountry.trim() ? 'Search or type state' : 'Select country first'}
                hint="Optional — refines city suggestions"
                error={errors.beneficiary_region_state?.message}
              />
              <LocationCombobox
                label="City / town"
                value={w('beneficiary_city')}
                onChange={(v) => setValue('beneficiary_city', v, { shouldValidate: true })}
                options={cityOptions}
                loading={locationLoading}
                disabled={!beneficiaryCountry.trim()}
                placeholder={beneficiaryCountry.trim() ? 'Search or type city' : 'Select country first'}
                error={errors.beneficiary_city?.message}
              />
              <Input
                label="Postal / ZIP code"
                className="font-mono uppercase"
                error={errors.beneficiary_postal_code?.message}
                {...register('beneficiary_postal_code')}
              />
          </>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-950">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-emerald-300 text-primary-dark focus:ring-primary-dark/30"
            {...register('save_beneficiary')}
          />
          Save this beneficiary for future transfers
        </label>
      </div>

      {/* Bank */}
      <div className="space-y-3">
        <SectionTitle>Bank information</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Bank legal name"
              error={errors.beneficiary_bank_name?.message}
              {...register('beneficiary_bank_name')}
            />
          </div>
          <Input
            label="SWIFT / BIC"
            placeholder="8 or 11 characters"
            className="font-mono uppercase"
            error={errors.beneficiary_bic_swift?.message}
            {...register('beneficiary_bic_swift')}
          />
          <StyledSelect label="Account identifier type" {...register('account_number_type')}>
              {ACCOUNT_NUMBER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'IBAN' && 'IBAN'}
                  {t === 'ACCOUNT' && 'Account number'}
                  {t === 'CLABE' && 'CLABE (Mexico)'}
                  {t === 'UK_SORT' && 'Sort code + account (UK)'}
                  {t === 'US_ROUTING' && 'Routing + account (US)'}
                </option>
              ))}
          </StyledSelect>
          {acctType === 'IBAN' && (
            <div className="sm:col-span-2">
              <Input
                label="IBAN"
                className="font-mono"
                error={errors.beneficiary_iban?.message}
                {...register('beneficiary_iban')}
              />
            </div>
          )}
          {acctType === 'UK_SORT' && (
            <>
              <Input
                label="Sort code"
                placeholder="6 digits"
                className="font-mono"
                error={errors.beneficiary_sort_code?.message}
                {...register('beneficiary_sort_code')}
              />
              <Input
                label="Account number"
                className="font-mono"
                error={errors.beneficiary_account_number?.message}
                {...register('beneficiary_account_number')}
              />
            </>
          )}
          {acctType === 'US_ROUTING' && (
            <>
              <Input
                label="Routing number (ABA)"
                placeholder="9 digits"
                className="font-mono"
                error={errors.beneficiary_routing_number?.message}
                {...register('beneficiary_routing_number')}
              />
              <Input
                label="Account number"
                className="font-mono"
                error={errors.beneficiary_account_number?.message}
                {...register('beneficiary_account_number')}
              />
            </>
          )}
          {(acctType === 'ACCOUNT' || acctType === 'CLABE') && (
            <div className="sm:col-span-2">
              <Input
                label={acctType === 'CLABE' ? 'CLABE (18 digits)' : 'Account number'}
                className="font-mono"
                error={errors.beneficiary_account_number?.message}
                {...register('beneficiary_account_number')}
              />
            </div>
          )}
          <LocationCombobox
            label="Bank country"
            value={bankCountry}
            onChange={(iso) => {
              setValue('beneficiary_bank_country', iso, { shouldValidate: true })
              setValue('beneficiary_bank_city', '')
            }}
            options={countryOptions}
            loading={locationLoading}
            selectOnly
            formatCommitted={formatCountry}
            placeholder="Search country"
            hint="Type to filter the list, then select a country"
            error={errors.beneficiary_bank_country?.message}
          />
          <LocationCombobox
            label="Bank city"
            value={w('beneficiary_bank_city')}
            onChange={(v) => setValue('beneficiary_bank_city', v, { shouldValidate: true })}
            options={bankCityOptions}
            loading={locationLoading}
            disabled={!bankCountry.trim()}
            placeholder={bankCountry.trim() ? 'Search or type city' : 'Select bank country first'}
            hint="Suggestions from location data — you can still type any city"
            error={errors.beneficiary_bank_city?.message}
          />
        </div>
      </div>

      {/* Reference */}
      <div className="space-y-3">
        <SectionTitle>Payment reference</SectionTitle>
        <Input
          label="Remittance / invoice reference (optional)"
          placeholder="e.g. INV-2026-001 (max 35 characters)"
          error={errors.remittance_reference?.message}
          {...register('remittance_reference')}
        />
      </div>

      {/* Correspondent & extra details */}
      <div className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white/40">
        <button
          type="button"
          onClick={() => setAdditionalOpen((open) => !open)}
          aria-expanded={additionalOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/60"
        >
          <div>
            <p className="text-xs font-semibold text-emerald-950">Additional details</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-900/75">
              Optional — correspondent bank, extra address lines, and instructions
            </p>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-emerald-800 transition-transform',
              additionalOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {additionalOpen ? (
          <div className="border-t border-emerald-200/70 px-4 pb-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Beneficiary address line 2"
                error={errors.beneficiary_address_line2?.message}
                {...register('beneficiary_address_line2')}
              />
              <Input
                label="Region / state"
                error={errors.beneficiary_region_state?.message}
                {...register('beneficiary_region_state')}
              />
              <Input
                label="Bank street address line 1"
                error={errors.beneficiary_bank_address_line1?.message}
                {...register('beneficiary_bank_address_line1')}
              />
              <Input
                label="Intermediary bank name"
                error={errors.intermediary_bank_name?.message}
                {...register('intermediary_bank_name')}
              />
              <Input
                label="Intermediary BIC"
                className="font-mono uppercase"
                error={errors.intermediary_bank_bic?.message}
                {...register('intermediary_bank_bic')}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Instructions to beneficiary bank"
                  error={errors.instructions_to_beneficiary_bank?.message}
                  {...register('instructions_to_beneficiary_bank')}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
