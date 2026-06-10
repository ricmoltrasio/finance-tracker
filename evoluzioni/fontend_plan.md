Struttura semplificata
text
frontend/
├── src/
│   ├── App.tsx                    — router + auth provider
│   ├── api/
│   │   ├── client.ts              — fetch con Bearer token
│   │   ├── transactions.ts
│   │   ├── categories.ts
│   │   ├── import.ts
│   │   └── settings.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── BottomNav.tsx      — mobile
│   │   │   └── Header.tsx
│   │   ├── common/
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   └── Toast.tsx
│   │   ├── charts/
│   │   │   └── BalanceChart.tsx   — linea andamento
│   │   ├── transactions/
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionRow.tsx
│   │   │   ├── TransactionDrawer.tsx
│   │   │   └── SplitForm.tsx
│   │   ├── categories/
│   │   │   └── CategoryBudgetBar.tsx
│   │   └── import/
│   │       ├── DropZone.tsx
│   │       ├── ColumnMapper.tsx
│   │       └── ImportReport.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Overview.tsx
│   │   ├── Transactions.tsx
│   │   ├── Import.tsx
│   │   ├── Categories.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTransactions.ts
│   │   ├── useSummary.ts
│   │   ├── useTimeline.ts
│   │   └── useCategories.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── format.ts
│       └── storage.ts             — token in localStorage
├── .env
└── package.json

Autenticazione — allineata al backend
typescript
// api/client.ts
const API_URL = import.meta.env.VITE_API_URL
const API_TOKEN = import.meta.env.VITE_API_SECRET_KEY

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
      ...options?.headers,
    },
  })
}
Login semplificato:
Nessuna email/password
L'utente inserisce il token (una volta) → saved in localStorage
Oppure token già in .env (se app personale)
tsx
// Login.tsx — minimale
function Login() {
  const [token, setToken] = useState('')
  const { login } = useAuth()

  return (
    <div>
      <h1>Finance Tracker</h1>
      <Input 
        type="password" 
        placeholder="Inserisci API Key"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button onClick={() => login(token)}>Accedi</Button>
    </div>
  )
}

Panoramica — usando gli endpoint veri
typescript
// hooks/useSummary.ts
export function useSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['summary', from, to],
    queryFn: () => apiFetch(`/transactions/summary?from=${from}&to=${to}`)
  })
}

// hooks/useTimeline.ts
export function useTimeline(from: string, to: string) {
  return useQuery({
    queryKey: ['timeline', from, to],
    queryFn: () => apiFetch(`/transactions/timeline?from=${from}&to=${to}&granularity=day`)
  })
}
Nella pagina Overview:
tsx
const { data: summary } = useSummary(from, to)
const { data: timeline } = useTimeline(from, to)

// Saldo a fine periodo = ultimo punto del timeline
const endBalance = timeline?.data?.[timeline.data.length - 1]?.saldo_cumulativo

Categorie — hard-coded iniziali (poi AI)
Le 10 categorie concordate:
typescript
// types/index.ts
export const CATEGORIES = [
  'Cibo',
  'Auto',
  'Salute',
  'Intrattenimento',
  'Abbonamenti',
  'Shopping',
  'Teatro e cinema (corso)',
  'Spostamenti',
  'Viaggi',
  'Altro'
] as const
Più tardi, quando implementi l'AI categorizer, diventeranno dinamiche.

Import — allineato agli step del backend
Step 1: POST /import/preview con file
Step 2: Mapping colonne (usa i profili salvati)
Step 3: POST /import/confirm con i dati
Step 4: Report
Niente magic, niente overcomplicazione.

⚙️ Settings — solo ciò che serve
tsx
// Settings.tsx
function Settings() {
  const { data: settings } = useSettings()
  const updateSetting = useUpdateSetting()

  return (
    <div>
      <h2>Preferenze</h2>
      <div>
        <label>Valuta</label>
        <Select value={settings?.currency} onChange={...}>
          <option>EUR</option>
          <option>USD</option>
        </Select>
      </div>
      
      <h2>Profili Import</h2>
      <ProfilesList />
      
      <h2>Danger Zone</h2>
      <Button variant="danger">Esporta CSV</Button>
      <Button variant="danger-outline">Elimina tutti i dati</Button>
    </div>
  )
}

Riassunto delle semplificazioni
Prima
Dopo
Supabase Auth
Bearer token statico
Zustand + localStorage
useState + context
Tweaks panel
❌ Rimosso
Saldo da settings
Calcolato da timeline
shadcn/ui
Componenti custom minimi
Categorie dinamiche
Hard-coded (poi AI)


Stack finale (semplificato)
text
React 18 + TypeScript
Vite
Tailwind CSS
TanStack Query
TanStack Table (virtualizzata)
Recharts (solo grafico timeline)
React Hook Form + Zod
Vercel (hosting)




