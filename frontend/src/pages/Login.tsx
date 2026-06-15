import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/errors'
import { Icon } from '../components/common/Icon'
import { Input } from '../components/common/Input'
import { Button } from '../components/common/Button'

type Form = { email: string; password: string }

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>()

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (e: unknown) {
      setError(errorMessage(e, 'Credenziali non valide'))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-[#06120e] shadow-[0_6px_24px_rgba(87,217,176,0.4)]">
            <Icon name="trendUp" size={22} stroke={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-label tracking-tight">Finance Tracker</h1>
            <p className="mt-1 text-sm text-muted">Accedi al tuo account</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface border border-white/[0.07] p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="nome@esempio.it"
              {...register('email', { required: true })}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password', { required: true })}
            />
            {error && (
              <p className="rounded-xl bg-expense/10 border border-expense/20 px-3 py-2 text-sm text-expense">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
