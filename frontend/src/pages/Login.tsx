import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/common/Input'
import { Button } from '../components/common/Button'

type Form = { email: string; password: string }

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>()

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (e: any) {
      setError(e.message ?? 'Credenziali non valide')
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Finance Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">Accedi al tuo account</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
