import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { Icon } from '../components/common/Icon'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Le password non coincidono'); return }
    if (password.length < 6) { setError('Minimo 6 caratteri'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-[#06120e] shadow-[0_6px_24px_rgba(87,217,176,0.4)]">
            <Icon name="trendUp" size={22} stroke={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-label tracking-tight">Nuova password</h1>
            <p className="mt-1 text-sm text-muted">Scegli una password sicura</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface border border-white/[0.07] p-6">
          {done ? (
            <p style={{ textAlign: 'center', color: 'var(--in)', fontWeight: 600 }}>
              Password aggiornata. Reindirizzo…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">Nuova password</label>
                <input
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Conferma password</label>
                <input
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="rounded-xl bg-expense/10 border border-expense/20 px-3 py-2 text-sm text-expense">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-accent"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading}
              >
                {loading ? 'Salvataggio…' : 'Imposta password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
