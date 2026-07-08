import { useCallback } from 'react'
import { useSessionState } from './useSessionState'

/** Selezione esercenti per la pagina corrente (parziali per luogo di spesa).
 *
 *  Scope per-pagina (chiave sessionStorage distinta): la selezione fatta in
 *  Transazioni non segue in Budget o Mappa. Toggle per descrizione esatta,
 *  coerente con la vista "Raggruppa esercenti". */
export function useMerchantSelection(pageKey: string) {
  const [merchants, setMerchants] = useSessionState<string[]>(
    `merchant-filter-${pageKey}`,
    []
  )

  const toggle = useCallback(
    (description: string) => {
      setMerchants((prev) =>
        prev.includes(description)
          ? prev.filter((d) => d !== description)
          : [...prev, description]
      )
    },
    [setMerchants]
  )

  const clear = useCallback(() => setMerchants([]), [setMerchants])

  return {
    merchants,
    toggle,
    clear,
    /** undefined quando vuota: i parametri query spariscono dalle richieste */
    asParam: merchants.length ? merchants : undefined,
  }
}
