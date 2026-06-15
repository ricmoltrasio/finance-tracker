import { useState, useEffect } from 'react'

/** useState persistito in sessionStorage (sopravvive alla navigazione, non alla chiusura tab). */
export function useSessionState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage pieno o non disponibile (private mode): lo stato resta solo in memoria
    }
  }, [key, value])

  return [value, setValue]
}
