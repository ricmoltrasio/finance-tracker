import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { importApi, type PreviewResult, type ImportConfirmBody, type ImportResult } from '../api/import'

type Step = 'upload' | 'mapping' | 'done'

export function useImport() {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const data = await importApi.preview(file)
      setPreview(data)
      setStep('mapping')
    } catch (e: any) {
      setError(e.message ?? 'Errore durante il caricamento')
    } finally {
      setLoading(false)
    }
  }

  const confirmImport = async (body: ImportConfirmBody) => {
    setLoading(true)
    setError(null)
    try {
      const data = await importApi.confirm(body)
      setResult(data)
      setStep('done')
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    } catch (e: any) {
      setError(e.message ?? 'Errore durante l\'importazione')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setPreview(null)
    setResult(null)
    setError(null)
  }

  return { step, preview, result, loading, error, uploadFile, confirmImport, reset }
}
