# Piano — Versione mobile

**Stato:** progettato, non implementato.
**Data progettazione:** giugno 2026.

Riprogettazione mirata delle schermate per l'uso touch su telefono. Non un semplice responsive: le aree dense vengono ripensate per scorrimento fluido, uso a una mano e target tattili adeguati. **Nessuna perdita di funzionalità** e **zero impatto sul desktop** (codice e resa attuali invariati).

---

## Stato attuale (da cosa partiamo)

Esiste già un adattamento responsive minimo a `@media (max-width: 860px)`:
- la `Sidebar` sparisce e compare la `BottomNav` (5 voci: Home · Movimenti · Budget · Importa · Settings);
- `.kpis` e `.grid2` passano a 1 colonna;
- esiste un **FAB** "Aggiungi" sulla Panoramica.

**Cosa NON è pensato per il touch (i veri problemi):**
1. **Filtri Transazioni** — due righe dense (pill periodo + dropdown mese + select categoria + ricerca + pill ordina + toggle esercenti + 2 date): su telefono si accavallano e i tap sono minuscoli.
2. **Drawer laterali** (dettaglio/nuova transazione, transazioni per categoria) — entrano da destra a 430px: su mobile diventano quasi a tutto schermo ma con l'ergonomia sbagliata (azioni in alto, non raggiungibili con il pollice).
3. **Grafici** (`SaldoChart`, `SpendingBars`) — interazione basata su `onMouseMove`/hover + tooltip: sul touch non esiste hover.
4. **Target tattili** — pill ~33px, chip categoria, icone: sotto i 44×44pt raccomandati.
5. **Paginazione** Transazioni — pager a bottoni: su mobile ci si aspetta lo scroll.
6. **Breakdown categorie** della Panoramica con "pin multiplo nel grafico" — interazione di precisione, ostica su schermo piccolo.

---

## Approccio tecnico (come NON toccare il desktop)

Vincolo: il desktop non deve cambiare né nel codice né nella resa. Due leve, entrambe additive:

1. **CSS scoped a un nuovo breakpoint telefono** `@media (max-width: 640px)` (separato dall'attuale 860px usato come "tablet"). Tutte le regole mobile vivono lì → le regole desktop non vengono modificate. Si tiene 860px per il passaggio sidebar→bottomnav, si introduce 640px per i restyle profondi (bottom sheet, sizing tattile, foglio filtri).
2. **Hook `useIsMobile()`** (basato su `matchMedia`) per i casi in cui la struttura JSX cambia davvero (non basta il CSS): si renderizza il ramo mobile **accanto** a quello desktop, lasciando il ramo desktop **identico**. Es. la barra filtri delle Transazioni: `isMobile ? <FiltriMobile/> : <…righe attuali…>`.

Regola d'oro: ogni componente condiviso (grafici) riceve gli handler touch **in aggiunta** a quelli mouse, mai in sostituzione → il comportamento desktop resta bit-per-bit lo stesso.

**Stile invariato:** si riusano esattamente le CSS variables, i font, i colori e le componenti esistenti (`.card`, `.pill`, `.field`, `CatGlyph`, `Icon`, `switch`…). Nessun nuovo tema.

---

## Analisi: schermate critiche (in ordine di criticità)

| # | Schermata | Criticità | Riorganizzazioni NON banali |
|---|---|---|---|
| 1 | **Transazioni** | Alta | Filtri densi → foglio "Filtri"; paginazione → scroll infinito; drawer → bottom sheet; FAB per "Aggiungi" |
| 2 | **Panoramica** | Alta | Interazione grafici su touch; breakdown categorie con pin-multiplo da semplificare; KPI da impaginare |
| 3 | **Importazione** | Media | Tabella anteprima larga + mappatura colonne su schermo stretto |
| 4 | **Budget** | Media | Per lo più impila; card → bottom sheet; selettore periodo compatto; proiezioni che vanno a capo |
| 5 | **Impostazioni** | Bassa | Accordion categorie già touch-friendly; solo sizing e spaziature |
| 6 | **Login** | Minima | Già a scheda centrata, funziona |

---

## Piano per schermata (desktop → mobile)

### 1. Transazioni — la più impattata

**Desktop oggi:** 2 righe di filtri + lista paginata + "Aggiungi" in alto a destra + drawer laterali.

**Mobile:**
- **Barra superiore compatta**: campo **Ricerca** a tutta larghezza + pulsante **"Filtri"** con badge del numero di filtri attivi.
- **Foglio "Filtri" (bottom sheet)**: raccoglie periodo (pill scorrevoli), mese, **categoria** (riusa `CategorySelect`), intervallo date, **ordinamento** e toggle **"Raggruppa esercenti"**. Si applica con un bottone "Mostra risultati" in basso (raggiungibile col pollice).
- **Lista**: le `TransactionRow` restano (sono già a riga-card); **paginazione → scroll infinito** (carica le pagine successive allo scroll) per un'esperienza fluida.
- **"Aggiungi" → FAB** in basso a destra (sopra la bottom nav), come già sulla Panoramica.
- **Dettaglio/Nuova transazione → bottom sheet** (vedi componenti trasversali): azioni primarie ("Salva", "Elimina") in fondo.
- Vista "raggruppa esercenti": invariata come logica, l'accordion funziona già bene al tap.

**Differenza chiave vs desktop:** i filtri passano da "sempre visibili in 2 righe" a "on-demand in un foglio", e il pager sparisce a favore dello scroll.

### 2. Panoramica

**Desktop oggi:** riga KPI, pill periodo, `.grid2` (card grafici a sinistra + breakdown categorie a destra), lista recenti, FAB.

**Mobile (stack verticale di schede focalizzate, stile Copilot/Monarch):**
- **KPI**: da riga a **2×2** o a **carosello orizzontale** scorrevole (saldo attuale in evidenza in cima). Niente 4 numeri schiacciati su una riga.
- **Grafico saldo**: card dedicata; **interazione a tap/drag** invece dell'hover (vedi grafici). Tooltip ancorato sopra il punto, non `position: fixed` da mouse.
- **Spese per categoria**: il combo "barre + pin multiplo di categorie" è troppo fine per il touch → su mobile si **semplifica** a: barre per categoria con **drill su singola categoria al tap** (niente multi-pin). Funzionalità preservata (vedere le spese per categoria), interazione adatta al dito.
- **Breakdown categorie**: lista tappabile (riga ≥44pt) che porta al dettaglio categoria.
- **Recenti**: lista corta con "Vedi tutte" → Transazioni.

**Differenza chiave vs desktop:** la `.grid2` affiancata diventa una **pila di card**; il pin-multiplo nel grafico è sostituito da drill singolo.

### 3. Importazione

**Desktop oggi:** stepper 3 step, dropzone, ColumnMapper con **tabella anteprima larga** + select, report.

**Mobile:**
- **Stepper** compatto (numeri + barra di avanzamento).
- **Upload**: il drag&drop perde senso → primario il pulsante **"Scegli file"** (apre il document picker del telefono); la dropzone resta come contenitore.
- **Mappatura colonne**: form verticale (già quasi così) con select a piena larghezza e target ≥44pt.
- **Anteprima**: la tabella multi-colonna non sta in un telefono → mostrarla come **scroll orizzontale** dedicato *oppure* come **"card della prima riga"** (campo → valore in verticale) per validare la mappatura senza scroll laterale.
- **Report**: le 4 statistiche da griglia 2×2 (già ok).

**Differenza chiave vs desktop:** l'anteprima tabellare diventa scroll-x isolato o vista a card riga-per-riga.

### 4. Budget

**Desktop oggi:** pill periodo + dropdown mese, riga 3 KPI, griglia card categoria (2 col), card → drawer transazioni.

**Mobile:**
- **Selettore periodo collassato** (vedi componenti trasversali): un solo chip `Questo mese ▾` che si espande, al posto delle pill + dropdown mese affiancati.
- KPI: 3 in riga stanno stretti → **carosello** o 1+2.
- Card categoria: **1 colonna** (già previsto), con barra di avanzamento e proiezioni impaginate in verticale per non andare a capo male.
- **Tap su card categoria → bottom sheet** con le transazioni di quella categoria nel periodo (vedi sotto "Drill categoria").

**Drill categoria (risposta esplicita: cosa fa su mobile ciò che su desktop è il drawer laterale):**
Su desktop, cliccando una card categoria nel Budget si apre il `CategoryTxDrawer` (pannello da destra) con intestazione categoria + totale + numero movimenti e la lista delle transazioni. **Su mobile diventa un bottom sheet** che sale dal basso, **stesso contenuto identico** (nessuna funzione persa): glyph + nome categoria, totale e conteggio in testa, poi la lista delle transazioni della categoria nel periodo. Tap su una transazione → si apre il **dettaglio transazione** come secondo bottom sheet (impilato sopra, oppure il primo si chiude e si apre il dettaglio — vedi decisioni aperte). Chiusura con swipe-down / tap fuori / Escape. Azioni in fondo, raggiungibili col pollice.

**Differenza chiave vs desktop:** impilamento + selettore periodo collassato + il drawer laterale del drill categoria diventa bottom sheet (contenuto invariato).

### 5. Impostazioni

**Desktop oggi:** card saldo+valuta (2 col), salva, accordion categorie (keyword + budget).

**Mobile:**
- Le due card impostazioni si impilano (già responsive).
- Accordion categorie: già adatto al tap; solo aumentare altezze righe/handle e spaziature, textarea keyword comoda.

**Differenza chiave vs desktop:** minima, soprattutto sizing.

### 6. Login

Nessuna riorganizzazione; solo verifica di padding e target ≥44pt.

---

## Componenti trasversali (riuso massimo)

- **Bottom sheet** (sostituisce i drawer laterali su mobile): stesso contenuto, ma `@media (max-width:640px)` ri-stila `.drawer-scrim`/`.drawer` come foglio che sale dal basso (full width, `max-height: 90vh`, angoli alti arrotondati, maniglia di trascinamento, `slideUp`). **Solo CSS scoped → desktop invariato.** Azioni primarie in fondo.
- **Foglio Filtri** (nuovo, mobile-only): componente che incapsula i filtri Transazioni; sul desktop non viene montato.
- **Grafici touch**: aggiungere `onTouchStart/onTouchMove` a `SaldoChart` e `SpendingBars` (additivo rispetto a `onMouseMove`); tooltip posizionato in modo da non finire sotto il dito; `SpendingBars` usa già `position: fixed` per il tooltip → adattare l'ancoraggio al tocco.
- **Selettore periodo collassato** (mobile-only): invece della fila di pill sempre visibile (che occupa spazio e affolla), un **unico elemento "chip"** che mostra il periodo attivo (es. `Questo mese ▾`). Al tap si **espande** rivelando le opzioni — come popover/menu sotto al chip, oppure come mini bottom sheet con le pill + il mese specifico. Selezionata l'opzione, si richiude tornando al singolo chip. Vantaggi: una sola riga compatta, target ampio, coerente in Panoramica / Budget / (e dentro il foglio Filtri delle Transazioni). Il desktop mantiene la `.periodbar` a pill estese, invariata.
- **FAB**: già esistente; riusarlo come pattern per "Aggiungi" anche nelle Transazioni.

---

## Touch & accessibilità

- **Target ≥44×44pt**: sotto 640px alzare min-height/padding di pill, chip categoria, voci `.bnav`, bottoni icona, righe lista e select. Solo nel media query telefono.
- **Safe-area iOS**: la `.bottomnav` e i FAB devono rispettare `env(safe-area-inset-bottom)` (notch/home indicator) per non finire sotto la barra di sistema.
- **Uso a una mano**: azioni primarie in basso (bottom nav, FAB, bottoni "Salva/Applica" in fondo ai fogli).
- **Niente hover-only**: ogni informazione da hover (tooltip grafici, titoli) deve avere equivalente al tap.
- **Scroll fluido**: liste lunghe con scroll nativo; evitare scroll annidati che confliggono (es. dentro i bottom sheet).

---

## Stima effort e criticità

Stima in giornate-uomo (sviluppo + rifinitura), per un dev che conosce il codice.

| Area | Effort | Criticità principali |
|---|---|---|
| Infrastruttura (hook `useIsMobile`, breakpoint 640, bottom-sheet CSS, sizing tattile, safe-area) | 1–1.5 gg | Fondamenta per tutto il resto; va fatta bene per non toccare il desktop |
| Transazioni (foglio filtri + scroll infinito + FAB + sheet) | 2–3 gg | Scroll infinito con React Query (`useInfiniteQuery`) cambia l'hook lista; foglio filtri nuovo |
| Panoramica (KPI, grafici touch, semplificazione breakdown) | 2–3 gg | **Interazione grafici su touch** è la parte più delicata; ridisegno pin-multiplo→drill |
| Importazione (anteprima tabella, mappatura) | 1–1.5 gg | Resa dell'anteprima multi-colonna su schermo stretto |
| Budget (impilamento, sheet) | 0.5–1 gg | Bassa; per lo più CSS |
| Impostazioni + Login (sizing) | 0.5 gg | Minima |
| Test su dispositivi reali (iOS/Android, safe-area, tastiera che copre i campi) | 1 gg | La tastiera mobile che copre input/sheet è un classico da verificare |
| **Totale** | **~8–11 gg** | |

**Criticità trasversali da tenere d'occhio:**
- **Non regredire il desktop**: ogni restyle va dietro `@media (max-width:640px)` o dietro `useIsMobile`; serve un giro di verifica desktop dopo ogni schermata.
- **Grafici**: gli SVG-as-img con tooltip overlay sono tarati sul mouse; il porting al touch è la voce a rischio maggiore.
- **Scroll infinito vs sessione filtri**: l'attuale stato filtri è in `sessionStorage`; va conciliato con il caricamento incrementale.
- **Bottom sheet + tastiera**: quando si apre la tastiera per un campo dentro un foglio, il foglio deve restare usabile (scroll/resize).
- **Tap accidentali**: card e righe diventano cliccabili → distanziare le azioni secondarie per evitare errori.

---

## Fasi consigliate

1. **Fase 0 — Infrastruttura**: breakpoint 640, `useIsMobile`, bottom-sheet CSS scoped, sizing tattile, safe-area. (Sblocca tutto, desktop intatto.)
2. **Fase 1 — Transazioni**: foglio filtri + scroll infinito + sheet + FAB. (Massimo valore, schermata più usata.)
3. **Fase 2 — Panoramica**: impaginazione KPI, grafici touch, breakdown semplificato.
4. **Fase 3 — Budget + Importazione**: impilamento, sheet, anteprima.
5. **Fase 4 — Impostazioni/Login + test su dispositivi reali.**

---

## Decisioni aperte

- **Una sola codebase responsive** (hook + media query) **vs** un set di componenti `*.mobile.tsx` separati. Raccomandato: responsive con hook (meno duplicazione, desktop garantito invariato), componenti separati solo dove la struttura diverge molto (filtri Transazioni).
- **Pin-multiplo categorie** nella Panoramica: semplificare a drill singolo su mobile (consigliato) o replicarlo con una UI tattile dedicata.
- **Anteprima import**: scroll-x della tabella vs vista a card riga-per-riga.
- **Scroll infinito vs "carica altro"** a bottone: l'infinito è più fluido, il bottone più controllabile.
- Breakpoint telefono: 640px proposto; valutare 600/680 sui dispositivi reali.

### Decise
- **Drill categoria → dettaglio transazione: bottom sheet IMPILATO.** Il dettaglio si apre sopra la lista; chiudendolo si torna alla lista della categoria (più naturale il "indietro"). Va gestito l'ordine di chiusura (prima il dettaglio, poi la lista).
- **Selettore periodo collassato: POPOVER** ancorato sotto il chip (è in cima alla pagina, raggiungibile). Mini bottom sheet solo come fallback se in futuro il chip finisse in basso.
