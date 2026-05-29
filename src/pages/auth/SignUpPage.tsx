import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AuthBackLink,
  AuthDivider,
  AuthFooterLink,
  AuthFormCard,
  AuthFormHeader,
  AuthSocialButtons,
} from '@/components/auth/AuthFormShell'
import SplitAuthLayout from '@/components/layout/SplitAuthLayout'
import { Input, PasswordInput } from '@/components/forms/Input'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import Spinner from '@/components/ui/Spinner'
import { authApi } from '@/api/auth'

const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm'],
  })
type FormData = z.infer<typeof schema>

export default function SignUpPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const password = watch('password', '')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await authApi.register(data)
      toast.success('Account created! Please sign in.')
      navigate('/auth/signin')
    } catch (err: unknown) {
      const ax = err as {
        code?: string
        message?: string
        response?: { data?: Record<string, string | string[]>; status?: number }
      }
      if (ax.code === 'ERR_CANCELED' || ax.message?.toLowerCase().includes('cancel')) {
        toast.error(
          'Registration took too long, but your account may already exist. Try signing in, or use a different email.',
        )
        return
      }
      const errData = ax.response?.data
      let msg = 'Registration failed.'
      if (errData) {
        const flat = Object.values(errData).flat()
        msg = String(flat[0] ?? msg)
      }
      if (ax.response?.status === 400 && /already exists/i.test(msg)) {
        toast.error(msg)
        navigate('/auth/signin')
        return
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SplitAuthLayout fitViewport>
      <AuthFormCard signup>
        <AuthBackLink to="/" label="Back to home" />

        <AuthFormHeader
          title="Create your account"
          subtitle="Start your journey with SafaPay — secure, clear, and built for everyday banking."
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Full name"
              placeholder="Legal full name"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="name@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />
              {password ? <PasswordStrengthMeter password={password} /> : null}
            </div>
            <PasswordInput
              label="Confirm password"
              placeholder="••••••••"
              error={errors.password_confirm?.message}
              {...register('password_confirm')}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" {...register('terms')} />
            <span className="text-sm leading-snug text-gray-600">
              I agree to the{' '}
              <span className="font-semibold text-primary-dark">Terms and Conditions</span>
            </span>
          </label>
          {errors.terms ? <p className="text-xs text-red-500">{errors.terms.message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            {loading ? (
              <Spinner size="sm" className="border-white border-t-white/30" />
            ) : (
              <CheckCircle size={18} aria-hidden />
            )}
            Create account
          </button>
        </form>

        <AuthDivider label="Or sign up with" />
        <AuthSocialButtons />
        <AuthFooterLink prompt="Already have an account?" linkLabel="Log in" to="/auth/signin" />
      </AuthFormCard>
    </SplitAuthLayout>
  )
}
