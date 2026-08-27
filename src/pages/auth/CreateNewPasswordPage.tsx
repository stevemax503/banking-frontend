import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AuthBackLink,
  AuthFormCard,
  AuthFormHeader,
} from '@/components/auth/AuthFormShell'
import SplitAuthLayout from '@/components/layout/SplitAuthLayout'
import { PasswordInput } from '@/components/forms/Input'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import Spinner from '@/components/ui/Spinner'
import { authApi } from '@/api/auth'
import { cn } from '@/utils/cn'

const schema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    new_password_confirm: z.string(),
  })
  .refine((d) => d.new_password === d.new_password_confirm, {
    message: 'Passwords do not match',
    path: ['new_password_confirm'],
  })
type FormData = z.infer<typeof schema>

export default function CreateNewPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })
  const password = watch('new_password', '')

  const requirements = [
    { label: 'At least 8 characters long', met: password.length >= 8 },
    { label: 'One uppercase & one lowercase character', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'One special character (!@#$%)', met: /[^A-Za-z0-9]/.test(password) },
  ]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await authApi.confirmPasswordReset({ token, ...data })
      toast.success('Password reset successful!')
      navigate('/auth/signin')
    } catch {
      toast.error('Invalid or expired reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SplitAuthLayout>
      <AuthFormCard>
        <AuthBackLink to="/auth/signin" label="Back to sign in" />
        <AuthFormHeader
          title="Create new password"
          subtitle="Your new password must be different from passwords you've used before on this account."
        />

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary-dark/10 bg-primary-dark/[0.04] px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/25 text-primary-dark">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-gray-600">Use a unique passphrase you don&apos;t reuse on other sites.</p>
        </div>

        {!token ? (
          <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            This reset link is missing or invalid.{' '}
            <Link to="/auth/forgot-password" className="font-semibold underline">
              Request a new one
            </Link>
            .
          </p>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <PasswordInput
              label="New password"
              placeholder="••••••••"
              error={errors.new_password?.message}
              {...register('new_password')}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <PasswordInput
            label="Confirm new password"
            placeholder="••••••••"
            error={errors.new_password_confirm?.message}
            {...register('new_password_confirm')}
          />

          <button type="submit" disabled={loading || !token} className="btn-primary mt-1 flex w-full items-center justify-center gap-2">
            {loading ? <Spinner size="sm" className="border-white border-t-white/30" /> : null}
            Reset password
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <p className="mb-3 text-sm font-semibold text-primary-dark">Password requirements</p>
          <ul className="space-y-2">
            {requirements.map((req) => (
              <li key={req.label} className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} className={cn(req.met ? 'text-primary-dark' : 'text-gray-300')} aria-hidden />
                <span className={req.met ? 'text-gray-700' : 'text-gray-400'}>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </AuthFormCard>
    </SplitAuthLayout>
  )
}
