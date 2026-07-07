# Evolutive — Filtro esercenti (parziali per luogo di spesa)

**Stato:** progettata, non implementata.
**Data progettazione:** luglio 2026.

---

## Obiettivo

In ogni lista di transazioni (**Transazioni**, **Budget**, **Mappa**) poter selezionare uno o più esercenti con un gesto rapido — **doppio click** su desktop, **pressione prolungata** su mobile — e vedere i numeri della pagina filtrati su quelle sole transazioni. Esempio: seleziono "Penny Market Saronno" e poi "Esselunga via Monviso" → vedo il parziale combinato dei due (movimenti, totale speso).

## Decisioni prese (luglio 2026)

- **Match per descrizione esatta** della transazione cliccata — coerente con il raggruppamento di "Raggruppa esercenti" (che usa la stessa chiave). Per una catena su più città (descrizioni diverse) si selezionano le singole righe con più gesti. Un eventuale match "per insegna" (fuzzy) è escluso: imprevedibile.
- **Scope per singola pagina**: ogni pagina ha la sua selezione indipendente; cambiando pagina il filtro non segue. Niente stato globale cross-page, la Panoramica non è coinvolta.
- La selezione **si combina in AND** con i filtri già attivi (periodo, categoria, ricerca).

---

## UX

### Gesto (in `TransactionRow`, quindi vale in ogni lista che lo usa)

- **Desktop — doppio click** sulla riga: aggiunge/rimuove (toggle) l'esercente dalla selezione.
  Nota tecnica: la riga oggi apre il drawer al click singolo → il click singolo va ritardato di ~250 ms per distinguere il doppio; l'apertura del drawer acquisisce quindi un ritardo impercettibile.
- **Mobile — pressione prolungata** (~500 ms): stesso toggle. Annullata se il dito si muove (scroll); `preventDefault` per evitare il click fantasma e il menu contestuale; `navigator.vibrate(10)` come feedback dove supportato (Android).
- **Nice-to-have**: nella vista "Raggruppa esercenti", doppio click sull'intestazione del gruppo = selezione del gruppo (stessa chiave descrizione).

### Feedback visivo

- Le righe degli esercenti selezionati restano **evidenziate** (bordo/tinta accent, riuso variabili CSS esistenti).
- **Barra chip** sopra la lista quando c'è almeno una selezione: un chip per esercente (descrizione troncata + ✕ per rimuovere) + pulsante "Azzera".
- La selezione persiste al refresh **entro la sessione** via `useSessionState` (stesso pattern degli altri filtri), con chiave per-pagina.

### Effetto per pagina

| Pagina | Dove si seleziona | Cosa viene filtrato |
|---|---|---|
| **Transazioni** | lista (anche dentro i gruppi esercente) | la lista stessa + una **riga parziale** sopra la lista: `N esercenti · M movimenti · spese −€X (· entrate +€Y se presenti)` — la pagina non ha KPI, questo è il parziale richiesto |
| **Budget** | lista del drill categoria (`CategoryTxDrawer`) | KPI entrate/spese/risparmio + card categorie (tutto passa da `useSummary`) |
| **Mappa** | lista transazioni della sidebar/sheet città | marker, cluster e statistiche città (tutto passa da `GET /locations/map`) |

---

## Architettura

### Backend — parametro `descriptions`

Nuovo parametro opzionale **ripetibile** (`?descriptions=A&descriptions=B` — le descrizioni possono contenere virgole, quindi niente formato comma-separated) su:

- `GET /transactions` → `.in_("description", values)`
- `GET /transactions/summary` → idem (alimenta parziale Transazioni e KPI/card Budget)
- `GET /locations/map` → idem

In FastAPI: `descriptions: Optional[list[str]] = Query(None)`. `timeline` per ora **non** serve (la Panoramica è esclusa e il Budget non la usa); aggiungerlo dopo è banale se servirà.

I KPI filtrati sono quindi **calcolati dal DB**, non stimati client-side sulla pagina corrente della lista (che è paginata).

### Frontend

- **`useMerchantSelection(pageKey)`** — hook che incapsula `useSessionState<string[]>` + `toggle(desc)` / `clear()` / `has(desc)`.
- **`MerchantChips`** — componente barra chip riusato nelle tre pagine.
- **`TransactionRow`** — due prop opzionali: `onToggleMerchant?: (desc: string) => void` e `merchantSelected?: boolean`. Il gesto (timer doppio click + long-press) vive qui dentro, una sola volta. Dove le prop non vengono passate (recenti in Panoramica, transazioni eliminate) il gesto è disattivato e nulla cambia.
- **Hook dati** — `useTransactions` / `useSummary` / query mappa: `descriptions` entra nei parametri e nelle query key di React Query (refetch automatico al cambio selezione).

---

## Casi limite

- **Toggle**: il gesto su un esercente già selezionato lo rimuove.
- **Selezione + ricerca/periodo/categoria**: AND, nessun conflitto (il backend applica tutti i filtri).
- **Scroll infinito** (Transazioni): funziona invariato, il filtro è server-side.
- **Split**: si filtra per descrizione della transazione padre, come ovunque.
- **Descrizioni molto lunghe** nei chip: troncare con ellipsis, title/tooltip con testo pieno.
- **Doppio click accidentale su mobile**: il doppio tap NON attiva la selezione (solo long-press), per non confliggere con lo zoom/tap.

---

## Fasi

1. **Backend** — parametro `descriptions` sui 3 endpoint + piccolo test se utile. (~0,5 g)
2. **Transazioni** — hook selezione + gesto in `TransactionRow` + chip bar + riga parziale (via `summary`). È la pagina di riferimento. (~1 g)
3. **Budget** — passare `descriptions` a `useSummary`; chip bar in testa; gesto già attivo nel drill. (~0,25 g)
4. **Mappa** — parametro su `locations/map`; chip bar; gesto nella lista sidebar. (~0,25 g)
5. **Rifiniture mobile** — long-press su dispositivo reale (soglia, vibrazione, conflitti con scroll), tap target chip. (~0,25 g)

**Totale stimato: ~2 giornate.**

---

## Fuori scope (esplicitamente)

- Filtro globale cross-page / Panoramica (deciso: per-pagina).
- Match per insegna/fuzzy (deciso: descrizione esatta).
- Persistenza oltre la sessione (localStorage/DB): la selezione è uno strumento di analisi momentanea.
