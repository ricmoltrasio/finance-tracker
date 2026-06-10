import { useState } from 'react'
import type { PreviewResult, ImportConfirmBody } from '../../api/import'
import { Button } from '../common/Button'
import { Select } from '../common/Input'
import { Spinner } from '../common/Spinner'

interface Props {
  preview: PreviewResult
  onConfirm: (body: ImportConfirmBody) => void
  loading?: boolean
}

export function ColumnMapper({ preview, onConfirm, loading }: Props) {
  const suggested = preview.suggested_profile
  const colOptions = ['', ...preview.columns]

  const [colDate, setColDate] = useState(suggested?.col_date ?? '')
  const [colDesc, setColDesc] = useState(suggested?.col_desc ?? '')
  const [amountFormat, setAmountFormat] = useState<'single' | 'dare_avere'>(
    suggested?.amount_format ?? 'single'
  )
  const [colAmount, setColAmount] = useState(suggested?.col_amount ?? '')
  const [colDare, setColDare] = useState(suggested?.col_dare ?? '')
  const [colAvere, setColAvere] = useState(suggested?.col_avere ?? '')
  const [bankName, setBankName] = useState(suggested?.bank_name ?? '')

  const isValid =
    colDate && colDesc && (amountFormat === 'single' ? colAmount : colDare && colAvere)

  const handleConfirm = () => {
    onConfirm({
      col_date: colDate,
      col_desc: colDesc,
      amount_format: amountFormat,
      col_amount: amountFormat === 'single' ? colAmount : undefined,
      col_dare: amountFormat === 'dare_avere' ? colDare : undefined,
      col_avere: amountFormat === 'dare_avere' ? colAvere : undefined,
      raw_rows: preview.raw_rows,
      bank_name: bankName || undefined,
    })
  }

  const colOpts = colOptions.map((c) => (
    <option key={c} value={c}>{c || '— seleziona —'}</option>
  ))

  return (
    <div className="space-y-5">
      {suggested && (
        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Profilo rilevato automaticamente: <strong>{suggested.bank_name}</strong>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Colonna data" value={colDate} onChange={(e) => setColDate(e.target.value)}>
          {colOpts}
        </Select>
        <Select label="Colonna descrizione" value={colDesc} onChange={(e) => setColDesc(e.target.value)}>
          {colOpts}
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Formato importo</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmountFormat('single')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${amountFormat === 'single' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
          >
            Colonna singola
          </button>
          <button
            type="button"
            onClick={() => setAmountFormat('dare_avere')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${amountFormat === 'dare_avere' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
          >
            Dare / Avere
          </button>
        </div>
      </div>

      {amountFormat === 'single' ? (
        <Select label="Colonna importo" value={colAmount} onChange={(e) => setColAmount(e.target.value)}>
          {colOpts}
        </Select>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Select label="Colonna Dare (uscite)" value={colDare} onChange={(e) => setColDare(e.target.value)}>
            {colOpts}
          </Select>
          <Select label="Colonna Avere (entrate)" value={colAvere} onChange={(e) => setColAvere(e.target.value)}>
            {colOpts}
          </Select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nome banca (opzionale)</label>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="es. Intesa Sanpaolo"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Sample preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Anteprima (5 righe)</p>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {preview.columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left text-gray-500 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {preview.columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 text-gray-700 max-w-32 truncate">{row[c]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button
        onClick={handleConfirm}
        disabled={!isValid || loading}
        className="w-full"
      >
        {loading ? <><Spinner className="h-4 w-4" /> Importazione in corso…</> : `Importa ${preview.raw_rows.length} righe`}
      </Button>
    </div>
  )
}
