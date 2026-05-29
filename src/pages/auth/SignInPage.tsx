import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SplitAuthLayout>
      <AuthFormCard>
        <AuthBackLink to="/" label="Back to home" />
        <AuthFormHeader title="Welcome back" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link
                to="/auth/forgot-password"
                className="text-sm font-semibold text-primary-dark transition-colors hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-dark focus:ring-primary/20"
              {...register('remember')}
            />
            <span className="text-sm text-gray-600">Keep me signed in</span>
          </label>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Spinner size="sm" className="border-white border-t-white/30" />}
            Sign in
          </button>
        </form>

        <AuthDivider label="Or continue with" />
        <AuthSocialButtons />
        <AuthFooterLink prompt="Don't have an account?" linkLabel="Sign up" to="/auth/signup" />
      </AuthFormCard>
    </SplitAuthLayout>
  )
}
