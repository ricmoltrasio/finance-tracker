import { useState, useEffect } from 'react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Input } from '../components/common/Input'
import { Button } from '../components/common/Button'
import { useSettings, useUpdateSetting } from '../hooks/useSettings'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSetting()
  const { toast } = useToast()

  const [saldo, setSaldo] = useState('')
  const [valuta, setValuta] = useState('EUR')

  useEffect(() => {
    if (settings) {
      setSaldo(settings.saldo_iniziale ?? '0')
      setValuta(settings.valuta ?? 'EUR')
    }
  }, [settings])

  const save = async () => {
    try {
      await update.mutateAsync({ key: 'saldo_iniziale', value: saldo })
      await update.mutateAsync({ key: 'valuta', value: valuta })
      toast('Impostazioni salvate', 'success')
    } catch {
      toast('Errore nel salvataggio', 'error')
    }
  }

  return (
    <div>
      <Header title="Impostazioni" />
      <div className="p-4 md:p-6 space-y-4 max-w-lg">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Saldo di partenza</h2>
          <p className="mb-3 text-xs text-gray-500">
            Il saldo del conto al momento in cui hai iniziato a usare l'app. Tutti i calcoli
            del timeline partono da questo valore.
          </p>
          <Input
            label="Saldo iniziale (€)"
            type="number"
            step="0.01"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            disabled={isLoading}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Valuta</h2>
          <select
            value={valuta}
            onChange={(e) => setValuta(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollaro</option>
            <option value="GBP">GBP — Sterlina</option>
          </select>
        </Card>

        <Button onClick={save} disabled={update.isPending || isLoading}>
          {update.isPending ? 'Salvataggio…' : 'Salva impostazioni'}
        </Button>
      </div>
    </div>
  )
}
