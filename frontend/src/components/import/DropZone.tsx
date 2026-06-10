import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'

interface Props {
  onFile: (file: File) => void
  loading?: boolean
  error?: string | null
}

export function DropZone({ onFile, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      alert('Formato non supportato. Usa CSV o Excel (.xlsx, .xls)')
      return
    }
    onFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handle(file)
      }}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handle(file)
        }}
      />

      {loading ? (
        <>
          <Spinner className="mb-3" />
          <p className="text-sm text-gray-500">Analisi del file in corso…</p>
        </>
      ) : (
        <>
          <Upload size={36} className="mb-3 text-gray-300" />
          <p className="mb-1 text-sm font-medium text-gray-700">
            Trascina il file qui
          </p>
          <p className="mb-4 text-xs text-gray-400">CSV o Excel — Intesa SP, UniCredit, Fineco e altri</p>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Sfoglia file
          </Button>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
