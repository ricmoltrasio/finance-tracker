import { DropZone } from '../components/import/DropZone'
import { ColumnMapper } from '../components/import/ColumnMapper'
import { ImportReport } from '../components/import/ImportReport'
import { useImport } from '../hooks/useImport'

const STEPS = [
  { key: 'upload', label: 'Carica' },
  { key: 'mapping', label: 'Mappa colonne' },
  { key: 'done', label: 'Report' },
] as const

export default function Import() {
  const { step, preview, result, loading, error, uploadFile, confirmImport, reset } = useImport()
  const activeIdx = STEPS.findIndex((s) => s.key === step)

  return (
    <main className="content anim-fade">
      <header className="topbar">
        <div>
          <h1 className="page-title">Importa</h1>
          <p className="page-sub">Carica un estratto conto CSV o Excel</p>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* stepper */}
        <div className="stepper">
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={'step' + (i === activeIdx ? ' on' : i < activeIdx ? ' done' : '')}>
                <span className="step-n">{i < activeIdx ? '✓' : i + 1}</span>
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className="step-line" />}
            </div>
          ))}
        </div>

        {step === 'upload' && <DropZone onFile={uploadFile} loading={loading} error={error} />}

        {step === 'mapping' && preview && (
          <div className="card">
            <ColumnMapper preview={preview} onConfirm={confirmImport} loading={loading} />
          </div>
        )}

        {step === 'done' && result && (
          <div className="card">
            <ImportReport result={result} onReset={reset} />
          </div>
        )}
      </div>
    </main>
  )
}
