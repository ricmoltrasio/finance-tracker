import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  // useCallback: referenza stabile, evita re-render dei consumer a ogni render del provider
  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-2xl border ${
              t.type === 'success'
                ? 'bg-income/10 border-income/20 text-income'
                : t.type === 'error'
                  ? 'bg-expense/10 border-expense/20 text-expense'
                  : 'bg-surface border-white/[0.07] text-label'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
