/**
 * Loan hero images live in `public/images/loans/` (served as `/images/loans/...`).
 * Open the URL in a new tab and use your browser’s “Save image as…” to keep a copy.
 */
export type LoanTypeVisual = {
  heroImage: string
  imageFullSizeUrl: string
  /** Optional external browse link (not used for bundled assets). */
  unsplashBrowseUrl?: string
  tagline: string
  fullDescription: string
}

const FILE_BY_TYPE: Record<string, string> = {
  PERSONAL: 'personal.avif',
  MORTGAGE: 'mortgage.avif',
  AUTO: 'auto.avif',
  BUSINESS: 'business.avif',
  EDUCATION: 'education.avif',
}

function loanImage(file: string) {
  return `/images/loans/${file}`
}

export const LOAN_IMAGE_DOWNLOAD_REFERENCE = (
  [
    ['PERSONAL', 'Personal borrowing'],
    ['MORTGAGE', 'Home & property'],
    ['AUTO', 'Vehicle finance'],
    ['BUSINESS', 'Business growth'],
    ['EDUCATION', 'Study & tuition'],
  ] as const
).map(([loanType, title]) => {
  const file = FILE_BY_TYPE[loanType]
  const url = loanImage(file)
  return { loanType, title, file, heroImage: url, imageFullSizeUrl: url }
})

/** Fixed order for loan-type cards (always show five tiles in the UI). */
export const LOAN_TYPE_ORDER = ['PERSONAL', 'MORTGAGE', 'AUTO', 'BUSINESS', 'EDUCATION'] as const
export type LoanCatalogType = (typeof LOAN_TYPE_ORDER)[number]

export const LOAN_TYPE_DISPLAY_NAMES: Record<LoanCatalogType, string> = {
  PERSONAL: 'Personal Loan',
  MORTGAGE: 'Home Mortgage',
  AUTO: 'Auto Loan',
  BUSINESS: 'Business Term Loan',
  EDUCATION: 'Education Loan',
}

/** Default limits per type (aligned with seed_data / migration); used when the API omits a product row. */
export const LOAN_CATALOG_LIMITS: Record<
  LoanCatalogType,
  { min_amount: string; max_amount: string; min_term_months: number; max_term_months: number }
> = {
  PERSONAL: { min_amount: '1000', max_amount: '50000', min_term_months: 6, max_term_months: 60 },
  AUTO: { min_amount: '5000', max_amount: '150000', min_term_months: 12, max_term_months: 84 },
  MORTGAGE: { min_amount: '50000', max_amount: '2000000', min_term_months: 60, max_term_months: 360 },
  BUSINESS: { min_amount: '100000000', max_amount: '5000000000', min_term_months: 12, max_term_months: 180 },
  EDUCATION: { min_amount: '2000', max_amount: '120000', min_term_months: 12, max_term_months: 180 },
}

const COPY: Record<string, Pick<LoanTypeVisual, 'tagline' | 'fullDescription'>> = {
  PERSONAL: {
    tagline: 'Fixed repayments for debt consolidation, life events, or a one-off project.',
    fullDescription: `A personal loan pays you a lump sum upfront with a fixed term and regular instalments—useful when you want a clear end date instead of revolving credit.

Common uses include consolidating higher-rate balances, medical or relocation costs, and larger purchases. Your rate depends on profile, amount, and term. You review the full repayment schedule after approval and before you accept.

SafaPay Bank assesses each request under responsible lending rules. Approved funds are sent to your linked account once disbursement completes.`,
  },
  MORTGAGE: {
    tagline: 'Long-term finance for a home you live in or hold as an investment.',
    fullDescription: `A mortgage spreads property cost over many years, secured against the home. That security often supports lower pricing than unsecured borrowing.

You may choose fixed or variable structures and a term that fits your plans. Completion typically involves valuation, legal review, and insurance where required.

Our team walks you through fees and milestones before you sign. Use the application flow to request approval in principle and upload documents when asked.`,
  },
  AUTO: {
    tagline: 'Finance a new or used vehicle with the car held as security.',
    fullDescription: `Auto loans are built around the vehicle: rate, term, and payment usually reflect the car’s age and mileage. Secured pricing is often lower than generic personal credit.

Dealer purchases and eligible private sales may qualify, subject to inspection. Optional add-ons such as warranty or insurance bundles are quoted separately so you can compare.

After approval, funds follow your instructions—often paid to the dealer—so you can complete purchase with confidence.`,
  },
  BUSINESS: {
    tagline: 'Working capital, equipment, or growth funding for trading businesses.',
    fullDescription: `Business loans support cash flow, capital expenditure, or expansion when income and costs do not line up. We review trading history, projections, and security where needed.

Eligible structures may include term loans, asset-backed facilities, or seasonal lines. Directors may need to provide guarantees or financial statements.

State purpose, amount, and term in your application. A relationship manager may contact you before a credit decision is issued.`,
  },
  EDUCATION: {
    tagline: 'Spread tuition and study costs with repayments aligned to your course.',
    fullDescription: `Education loans help students or guardians fund tuition, accommodation, or certification. Some products include grace periods tied to graduation.

We usually ask for admission letters, fee schedules, and identity checks. Funds may go to the institution directly when that simplifies paperwork.

Review limits and any co-borrower rules in your offer letter. Early repayment is allowed without penalty unless a specific promotion says otherwise.`,
  },
}

const REF = Object.fromEntries(
  LOAN_IMAGE_DOWNLOAD_REFERENCE.map((r) => [r.loanType, r]),
) as Record<string, (typeof LOAN_IMAGE_DOWNLOAD_REFERENCE)[number]>

export function getLoanTypeVisual(loanType: string): LoanTypeVisual {
  const ref = REF[loanType] ?? REF.PERSONAL
  const text = COPY[loanType] ?? COPY.PERSONAL
  return {
    heroImage: ref.heroImage,
    imageFullSizeUrl: ref.imageFullSizeUrl,
    unsplashBrowseUrl: undefined,
    tagline: text.tagline,
    fullDescription: text.fullDescription,
  }
}

export function loanTypeSortIndex(loanType: string): number {
  const idx = LOAN_TYPE_ORDER.indexOf(loanType as LoanCatalogType)
  return idx === -1 ? LOAN_TYPE_ORDER.length : idx
}

/** Merge API product fields with bundled fallbacks for the customer catalog. */
export function resolveLoanProductDisplay(product: {
  loan_type: string
  tagline?: string
  full_description?: string
  hero_image_url?: string | null
  description?: string
}): Pick<LoanTypeVisual, 'heroImage' | 'tagline' | 'fullDescription'> {
  const visual = getLoanTypeVisual(product.loan_type)
  const tagline = product.tagline?.trim() || visual.tagline
  const fullDescription = product.full_description?.trim() || visual.fullDescription
  const heroImage = product.hero_image_url?.trim() || visual.heroImage
  return { heroImage, tagline, fullDescription }
}
