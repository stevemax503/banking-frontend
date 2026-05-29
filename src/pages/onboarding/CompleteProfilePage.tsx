import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LogOut,
  ShieldCheck,
  Landmark,
  MapPin,
  Camera,
  ChevronDown,
  Check,
  User,
  Mail,
  Phone,
  Calendar,
  Hash,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { INTENDED_ACCOUNT_TYPES, ID_DOCUMENT_TYPES } from '@/lib/personalProfileOptions'
import SafaPayLogo from '@/components/brand/SafaPayLogo'
import { LocationCombobox } from '@/components/forms/LocationCombobox'
import {
  countryDisplayName,
  resolveCountryIso,
  useCityOptions,
  useCountryOptions,
  useLocationDataset,
  useStateOptions,
} from '@/lib/locationData'
import { cn } from '@/utils/cn'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

const STEPS = [
  { id: 'identity', label: 'Account & ID', icon: Landmark },
  { id: 'personal', label: 'Personal details', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
] as const

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

interface ProfileResponse {
  full_name: string
  phone: string
  email: string
  profile_picture: string | null
  address?: string
  date_of_birth?: string | null
  nationality?: string
  requires_profile_setup?: boolean
  intended_account_type?: string
  id_document_type?: string
  id_document_number?: string
}

type AddressFields = { street: string; state: string; city: string; zip: string; country: string }

function splitAddress(addr: string | undefined): AddressFields {
  if (!addr?.trim()) return { street: '', state: '', city: '', zip: '', country: '' }
  const parts = addr.split(/\n|,/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 5) {
    return {
      street: parts[0] || '',
      state: parts[1] || '',
      city: parts[2] || '',
      zip: parts[3] || '',
      country: parts[4] || '',
    }
  }
  if (parts.length === 4) {
    return { street: parts[0] || '', state: '', city: parts[1] || '', zip: parts[2] || '', country: parts[3] || '' }
  }
  return {
    street: parts[0] || '',
    state: '',
    city: parts[1] || '',
    zip: parts[2] || '',
    country: parts[3] || '',
  }
}

function joinAddress(a: AddressFields): string {
  return [a.street, a.state, a.city, a.zip, a.country].filter(Boolean).join('\n')
}

function isHeicFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return (
    n.endsWith('.heic') ||
    n.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  )
}

function ProfilePhotoPreview({
  avatarSrc,
  profilePictureFile,
  existingPicture,
  onSelectFile,
}: {
  avatarSrc: string | null
  profilePictureFile: File | null
  existingPicture: boolean
  onSelectFile: (file: File | null) => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const heic = profilePictureFile ? isHeicFile(profilePictureFile) : false
  const showImage = Boolean(avatarSrc) && !heic && !imgFailed

  useEffect(() => {
    setImgFailed(false)
  }, [avatarSrc, profilePictureFile])

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 justify-center sm:justify-start">
        {showImage ? (
          <img
            src={avatarSrc!}
            alt="Profile preview"
            className="h-32 w-28 rounded-xl border-2 border-white object-cover shadow-md"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-32 w-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-2 text-center text-gray-500">
            {heic || imgFailed ? (
              <>
                <Camera size={24} strokeWidth={1.5} className="text-primary-dark" />
                <span className="mt-2 text-[10px] font-semibold leading-tight text-primary-dark">Photo selected</span>
                <span className="mt-1 text-[9px] leading-tight text-gray-400">
                  {heic ? 'HEIC preview not supported in browser' : 'Preview unavailable'}
                </span>
              </>
            ) : (
              <>
                <Camera size={28} strokeWidth={1.5} />
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wide">Preview</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary sm:justify-start">
          <Camera size={16} />
          {profilePictureFile || existingPicture ? 'Change photo' : 'Upload photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,.heic,.heif"
            className="sr-only"
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Clear, front-facing image with good lighting. JPG or PNG recommended; HEIC from iPhone is accepted and will
          upload correctly.
        </p>
        {profilePictureFile ? (
          <p className="mt-1 text-xs font-medium text-primary-dark">{profilePictureFile.name}</p>
        ) : null}
      </div>
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-gray-700">
      {children}
      {required ? <span className="ml-0.5 text-accent-dark">*</span> : null}
    </label>
  )
}

function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={cn(
        'input-field w-full rounded-xl border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-shadow',
        'placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-accent/20',
        className,
      )}
      {...props}
    />
  )
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="input-field w-full cursor-pointer appearance-none rounded-xl border-gray-200 bg-white py-2.5 pl-3.5 pr-10 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-accent/20"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  )
}

function FormSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-gray-100 pb-10 last:border-b-0 last:pb-0">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white shadow-sm">
          <Icon size={20} strokeWidth={2} aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function CompleteProfilePage() {
  const { logout, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  })
  const profile = profileRes?.data as ProfileResponse | undefined

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [nationality, setNationality] = useState('')
  const [addr, setAddr] = useState<AddressFields>({
    street: '',
    state: '',
    city: '',
    zip: '',
    country: '',
  })
  const [intendedAccountType, setIntendedAccountType] = useState('')
  const [idDocumentType, setIdDocumentType] = useState('')
  const [idDocumentNumber, setIdDocumentNumber] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null)
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)

  const { data: csc, isLoading: cscLoading } = useLocationDataset()
  const countryOptions = useCountryOptions(csc)
  const stateOptions = useStateOptions(csc, addr.country)
  const cityOptions = useCityOptions(csc, addr.country, addr.state, stateOptions)

  const countryFieldDisplay = useMemo(() => {
    const raw = addr.country ?? ''
    if (!raw.trim() || !csc) return raw
    const iso = resolveCountryIso(csc, raw)
    if (!iso) return raw
    const name = countryDisplayName(csc, raw)
    if (raw.toUpperCase() === iso || raw === name) return `${name} (${iso})`
    return raw
  }, [addr.country, csc])

  useEffect(() => {
    if (!profilePictureFile) {
      setPhotoObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(profilePictureFile)
    setPhotoObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [profilePictureFile])

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setPhone(profile.phone || '')
    setEmail(profile.email || '')
    setDob(profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '')
    setNationality(profile.nationality || '')
    setAddr(splitAddress(profile.address))
    setIntendedAccountType(profile.intended_account_type || '')
    setIdDocumentType(profile.id_document_type || '')
    setIdDocumentNumber(profile.id_document_number || '')
    setProfilePictureFile(null)
  }, [profile])

  const setupComplete = profile?.requires_profile_setup !== true

  useEffect(() => {
    if (!setupComplete || isLoading || isLeaving) return
    let cancelled = false
    setIsLeaving(true)
    void (async () => {
      const ok = await refreshProfile()
      if (!cancelled && ok) navigate('/dashboard', { replace: true })
      else if (!cancelled) setIsLeaving(false)
    })()
    return () => {
      cancelled = true
    }
  }, [setupComplete, isLoading, isLeaving, navigate, refreshProfile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const addressStr = joinAddress(addr)
      const basePayload: Record<string, string | null> = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        date_of_birth: dob || null,
        nationality: nationality.trim() || '',
        address: addressStr,
        intended_account_type: intendedAccountType || null,
        id_document_type: idDocumentType || null,
        id_document_number: idDocumentNumber.trim() || null,
      }
      if (profilePictureFile) {
        const fd = new FormData()
        Object.entries(basePayload).forEach(([k, v]) => {
          if (v !== null && v !== '') fd.append(k, v)
        })
        fd.append('profile_picture', profilePictureFile)
        return authApi.updateProfile(fd)
      }
      return authApi.updateProfile(basePayload)
    },
    onSuccess: async () => {
      setIsLeaving(true)
      toast.success('Profile complete. Welcome to SafaPay Bank.')
      setProfilePictureFile(null)
      try {
        const res = await authApi.getProfile()
        queryClient.setQueryData(['profile'], res)
        const refreshed = await refreshProfile()
        if (!refreshed) {
          setIsLeaving(false)
          toast.error('Profile saved, but we could not refresh your session. Please reload the page.')
          return
        }
        navigate('/dashboard', { replace: true })
      } catch {
        setIsLeaving(false)
        toast.error('Profile saved, but we could not open your dashboard. Please reload the page.')
      }
    },
    onError: () => toast.error('Could not save profile.'),
  })

  const hasPhoto = Boolean(profilePictureFile || profile?.profile_picture)

  const stepDone = {
    identity: Boolean(intendedAccountType && idDocumentType && idDocumentNumber.trim() && hasPhoto),
    personal: Boolean(fullName.trim() && phone.trim() && dob),
    address: Boolean(addr.country.trim() && addr.city.trim() && addr.street.trim()),
  }

  const validate = (): boolean => {
    if (!stepDone.identity || !stepDone.personal || !stepDone.address) {
      toast.error('Please complete all required fields in each section.')
      return false
    }
    return true
  }

  if (isLoading || !profile || isLeaving || setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-dark border-t-transparent" />
          <p className="text-sm text-gray-500">
            {isLeaving || setupComplete ? 'Opening your dashboard…' : 'Loading your profile…'}
          </p>
        </div>
      </div>
    )
  }

  const initials = (fullName || profile.full_name || '?')
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const avatarSrc = photoObjectUrl || mediaUrl(profile.profile_picture)

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-primary-dark">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <SafaPayLogo variant="light" size="sm" showTagline={false} to={null} />
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col lg:flex-row lg:items-start">
        {/* Sidebar — steps & user (stays fixed while main form scrolls) */}
        <aside className="flex flex-col border-b border-gray-200 bg-white px-4 py-8 sm:px-6 lg:sticky lg:top-16 lg:z-20 lg:w-[300px] lg:shrink-0 lg:self-start lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:py-10 lg:pl-8 lg:pr-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-dark/60">Secure onboarding</p>
          <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight text-gray-900 sm:text-2xl">
            Complete your profile
          </h1>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-12 w-12 rounded-lg object-cover ring-2 ring-white" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-dark text-sm font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{profile.full_name}</p>
              <p className="truncate text-xs text-gray-500">{profile.email}</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Onboarding steps">
            {STEPS.map((step, i) => {
              const done = stepDone[step.id]
              const Icon = step.icon
              return (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    done ? 'bg-accent/15 text-primary-dark' : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      done ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <Icon size={16} className="shrink-0 opacity-70" aria-hidden />
                  <span className="font-medium">{step.label}</span>
                </a>
              )
            })}
          </nav>

          <div className="mt-8 hidden rounded-xl border border-accent/30 bg-accent/10 p-4 lg:mt-auto lg:flex lg:pt-8">
            <div className="flex gap-2">
              <ShieldCheck size={18} className="shrink-0 text-primary-dark" />
              <p className="text-xs leading-relaxed text-gray-600">
                Your data is encrypted in transit and at rest. We only use it to verify identity and open your account.
              </p>
            </div>
          </div>
        </aside>

        {/* Main form */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(21,42,30,0.08)]">
            <div className="bg-primary-dark px-6 py-5 sm:px-8">
              <p className="text-sm leading-relaxed text-white/90">
                Fields marked with <span className="font-semibold text-accent">*</span> are required. Your 16-digit account
                number and IBAN are issued after you submit.
              </p>
            </div>

            <div className="space-y-0 px-6 py-8 sm:px-8">
              <FormSection
                id="identity"
                icon={Landmark}
                title="Account type & identity"
                description="Choose how you'll bank with us and verify your identity with a government-issued ID."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label required>Account type</Label>
                    <SelectInput value={intendedAccountType} onChange={(e) => setIntendedAccountType(e.target.value)}>
                      <option value="">Select account type</option>
                      {INTENDED_ACCOUNT_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div>
                    <Label required>ID document type</Label>
                    <SelectInput value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value)}>
                      <option value="">Select document</option>
                      {ID_DOCUMENT_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="sm:col-span-2">
                    <Label required>ID number</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <TextInput
                        className="pl-10"
                        value={idDocumentNumber}
                        onChange={(e) => setIdDocumentNumber(e.target.value)}
                        placeholder="As printed on your document"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label required>Passport-style photo</Label>
                    <ProfilePhotoPreview
                      avatarSrc={avatarSrc}
                      profilePictureFile={profilePictureFile}
                      existingPicture={Boolean(profile.profile_picture)}
                      onSelectFile={setProfilePictureFile}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection
                id="personal"
                icon={User}
                title="Personal details"
                description="Confirm how we can reach you. Your email was set when you registered."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label required>Full name</Label>
                    <TextInput
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As printed on your document"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <TextInput className="cursor-not-allowed bg-gray-50 pl-10 text-gray-600" value={email} readOnly disabled />
                    </div>
                  </div>
                  <div>
                    <Label required>Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <TextInput className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 …" />
                    </div>
                  </div>
                  <div>
                    <Label required>Date of birth</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <TextInput
                        type="date"
                        className="pl-10"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <LocationCombobox
                      label="Nationality"
                      value={nationality}
                      onChange={setNationality}
                      options={countryOptions}
                      loading={cscLoading}
                      preferLabel
                      placeholder="Search or type country"
                      hint="Pick from the list or type your nationality"
                      inputClassName="rounded-xl border-gray-200 py-2.5 text-sm shadow-sm"
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection
                id="address"
                icon={MapPin}
                title="Residential address"
                description="Start with your country — then pick or type state and city, like international transfers."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <LocationCombobox
                      label="Country *"
                      value={countryFieldDisplay}
                      onChange={(v) =>
                        setAddr({ street: addr.street, state: '', city: '', zip: addr.zip, country: v })
                      }
                      options={countryOptions}
                      loading={cscLoading}
                      placeholder="Search or type country"
                      hint="Select country first to load states and cities"
                      inputClassName="rounded-xl border-gray-200 py-2.5 text-sm shadow-sm"
                    />
                  </div>
                  <div>
                    <LocationCombobox
                      label="State / region"
                      value={addr.state}
                      onChange={(v) => setAddr((a) => ({ ...a, state: v, city: '' }))}
                      options={stateOptions}
                      loading={cscLoading}
                      disabled={!addr.country.trim()}
                      placeholder={addr.country.trim() ? 'Search or type state' : 'Select country first'}
                      hint="Optional — narrows city list"
                      inputClassName="rounded-xl border-gray-200 py-2.5 text-sm shadow-sm"
                    />
                  </div>
                  <div>
                    <LocationCombobox
                      label="City *"
                      value={addr.city}
                      onChange={(v) => setAddr((a) => ({ ...a, city: v }))}
                      options={cityOptions}
                      loading={cscLoading}
                      disabled={!addr.country.trim()}
                      placeholder={addr.country.trim() ? 'Search or type city' : 'Select country first'}
                      inputClassName="rounded-xl border-gray-200 py-2.5 text-sm shadow-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label required>Street address</Label>
                    <TextInput
                      value={addr.street}
                      onChange={(e) => setAddr((a) => ({ ...a, street: e.target.value }))}
                      placeholder="Building, street, unit"
                    />
                  </div>
                  <div>
                    <Label>Postal / ZIP code</Label>
                    <TextInput value={addr.zip} onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))} />
                  </div>
                </div>
              </FormSection>
            </div>

            {/* Footer CTA */}
            <div className="flex flex-col gap-4 border-t border-gray-100 bg-gray-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-xs leading-relaxed text-gray-500">
                By submitting, you confirm your information is accurate and agree to SafaPay Bank&apos;s use of it for
                account opening and compliance.
              </p>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => {
                  if (!validate()) return
                  saveMutation.mutate()
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-dark px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary hover:shadow-lg disabled:opacity-60"
              >
                {saveMutation.isPending ? 'Saving…' : 'Complete profile'}
                {!saveMutation.isPending ? <ArrowRight size={18} strokeWidth={2} /> : null}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 p-4 lg:hidden">
            <ShieldCheck size={18} className="shrink-0 text-primary-dark" />
            <p className="text-xs leading-relaxed text-gray-600">
              Your data is encrypted in transit and at rest. We only use it to verify identity and open your account.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
