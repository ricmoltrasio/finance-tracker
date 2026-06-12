import { useState } from 'react'
import type { PreviewResult, ImportConfirmBody } from '../../api/import'
import { Spinner } from '../common/Spinner'

interface Props {
  preview: PreviewResult
  onConfirm: (body: ImportConfirmBody) => void
  loading?: boolean
}

export function ColumnMapper({ preview, onConfirm, loading }: Props) {
  const suggested = preview.suggested_profile
  const colOptions = ['', ...preview.columns]

  const cols = preview.columns
  const [colDate, setColDate] = useState(suggested?.col_date ?? cols[0] ?? '')
  const [colDesc, setColDesc] = useState(suggested?.col_desc ?? cols[2] ?? '')
  const [amountFormat, setAmountFormat] = useState<'single' | 'dare_avere'>(
    suggested?.amount_format ?? 'single'
  )
  const [colAmount, setColAmount] = useState(suggested?.col_amount ?? cols[7] ?? '')
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
    <option key={c} value={c}>
      {c || '— seleziona —'}
    </option>
  ))

  return (
    <div className="flex flex-col gap-4">
      {suggested && (
        <div
          style={{
            borderRadius: 11,
            padding: '10px 13px',
            fontSize: 13,
            color: 'var(--accent)',
            background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--accent) 25%, transparent)',
          }}
        >
          Profilo rilevato automaticamente: <strong>{suggested.bank_name}</strong>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Colonna data</label>
          <select className="field" value={colDate} onChange={(e) => setColDate(e.target.value)}>
            {colOpts}
          </select>
        </div>
        <div>
          <label className="field-label">Colonna descrizione</label>
          <select className="field" value={colDesc} onChange={(e) => setColDesc(e.target.value)}>
            {colOpts}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label">Formato importo</label>
        <div className="seg">
          <button
            type="button"
            className={amountFormat === 'single' ? 'on' : ''}
            onClick={() => setAmountFormat('single')}
          >
            Colonna singola
          </button>
          <button
            type="button"
            className={amountFormat === 'dare_avere' ? 'on' : ''}
            onClick={() => setAmountFormat('dare_avere')}
          >
            Dare / Avere
          </button>
        </div>
      </div>

      {amountFormat === 'single' ? (
        <div>
          <label className="field-label">Colonna importo</label>
          <select className="field" value={colAmount} onChange={(e) => setColAmount(e.target.value)}>
            {colOpts}
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Dare (uscite)</label>
            <select className="field" value={colDare} onChange={(e) => setColDare(e.target.value)}>
              {colOpts}
            </select>
          </div>
          <div>
            <label className="field-label">Avere (entrate)</label>
            <select className="field" value={colAvere} onChange={(e) => setColAvere(e.target.value)}>
              {colOpts}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="field-label">Nome banca (opzionale)</label>
        <input
          className="field"
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="es. Intesa Sanpaolo"
        />
      </div>

      {/* anteprima */}
      <div>
        <label className="field-label">Anteprima (5 righe)</label>
        <div
          style={{
            overflowX: 'auto',
            borderRadius: 11,
            border: '1px solid var(--line)',
          }}
        >
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                {preview.columns.map((c) => (
                  <th
                    key={c}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: 'var(--text-2)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  {preview.columns.map((c) => (
                    <td
                      key={c}
                      style={{
                        padding: '7px 12px',
                        color: 'var(--text)',
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        className="btn-accent"
        style={{ justifyContent: 'center', width: '100%', padding: '11px' }}
        onClick={handleConfirm}
        disabled={!isValid || loading}
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4" /> Importazione in corso…
          </>
        ) : (
          `Importa ${preview.raw_rows.length} righe`
        )}
      </button>
    </div>
  )
}
