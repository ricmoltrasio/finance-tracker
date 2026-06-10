import { Header } from '../components/layout/Header'
import { DropZone } from '../components/import/DropZone'
import { ColumnMapper } from '../components/import/ColumnMapper'
import { ImportReport } from '../components/import/ImportReport'
import { useImport } from '../hooks/useImport'

export default function Import() {
  const { step, preview, result, loading, error, uploadFile, confirmImport, reset } = useImport()

  return (
    <div>
      <Header title="Importa" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {step === 'upload' && (
          <DropZone onFile={uploadFile} loading={loading} error={error} />
        )}

        {step === 'mapping' && preview && (
          <ColumnMapper
            preview={preview}
            onConfirm={confirmImport}
            loading={loading}
          />
        )}

        {step === 'done' && result && (
          <ImportReport result={result} onReset={reset} />
        )}
      </div>
    </div>
  )
}
