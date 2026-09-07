# Evolutive — Skeleton loading (primo caricamento pagine)

**Stato:** implementata (settembre 2026).
**Data implementazione:** settembre 2026.

---

## Obiettivo

Il backend gira su **Google Cloud Run scale-to-zero** ([[project-context]]): al primo caricamento di una pagina dopo un periodo di inattività il cold start può far restare le query React Query in `isLoading` per diversi secondi. Prima di questa modifica ogni pagina mostrava in quell'attesa uno `<Spinner/>` centrato — un'esperienza percepita come "vuota". Obiettivo: sostituirla con skeleton che ricalcano la forma reale del contenuto di ogni pagina, coerenti tra desktop e mobile.

## Decisioni prese

- **Scope = solo primo caricamento pagina** (`isLoading` di React Query, vero solo senza dati in cache). Restano `<Spinner/>` invariati gli stati secondari non legati al "vuoto" da cold start: paginazione (`isFetchingNextPage` in Transazioni), fisarmonica "Transazioni eliminate" in Panoramica, bottoni con azione in corso, e lo spinner di `App.tsx` durante il check sessione Supabase (locale, non chiama il backend).
- **Import esclusa**: al mount della pagina non c'è alcuna query in `isLoading`, la DropZone è già interattiva da subito.
- **Nessun ramo mobile dedicato negli skeleton**: riusano le stesse classi CSS reali della pagina (`.kpis`, `.card`, `.catrow`, `.txrow`, `.cat-acc`, `.mgroup-head`, `.budget-card`...), quindi ereditano automaticamente il comportamento responsive già definito in `index.css`.

## Architettura

- **`index.css`** — classe `.skeleton` (shimmer via `background-position` animato, esisteva già ma non era mai usata) + `@keyframes shimmer`. Colore di riposo basato su `--hover` (non `--surface`): alcuni contenitori come `.cat-acc`/`.mappa-map-wrap` hanno già sfondo `--surface`, e uno skeleton dello stesso colore del genitore sarebbe rimasto invisibile fuori dal breve passaggio dello shimmer.
- **`components/common/Skeleton.tsx`** — primitiva (`<div class="skeleton">` + `style` per dimensioni/forma).
- **`components/skeletons/`** — un componente per ogni forma di contenuto, costruito sulle classi CSS reali (non layout nuovi):
  - `TxRowsSkeleton` — righe a forma di `.txrow` (usato in `TransactionList`, Panoramica "Ultime transazioni").
  - `MerchantGroupSkeleton` — righe a forma di `.mgroup-head` (usato in `MerchantGroupList`, vista "raggruppa esercenti").
  - `OverviewSkeleton` — KPI + grafico saldo/spese + categorie + transazioni recenti.
  - `BudgetSkeleton` — KPI + griglia card categoria (prende `isMobile` perché la griglia KPI di Budget è inline, non una classe CSS).
  - `SettingsCatSkeleton` — griglia `.cat-acc`.
- **Mappa** — nessun componente dedicato: blocco `<Skeleton>` che riempie `.mappa-map-wrap` al posto dello spinner overlay.
- **Impostazioni** — anche il campo "Saldo di partenza" (fuori da `SettingsCatSkeleton`, gestito a parte perché non è una lista) mostra uno skeleton invece di limitarsi a disabilitare l'input.
- Wiring: in ogni pagina/componente lista, `isLoading ? <XSkeleton /> : <contenuto reale />` al posto del precedente `<Spinner/>`.

## Fuori scope (esplicitamente)

- Messaggio "il server si sta risvegliando…" dopo una soglia di attesa (es. 5-8s): valutato ma rimandato — da aggiungere solo se lo skeleton da solo non basta sui cold start più lunghi osservati in produzione.
- Import.tsx e lo spinner di autenticazione in `App.tsx` (vedi Decisioni prese).
