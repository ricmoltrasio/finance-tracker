import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="content anim-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <p style={{ fontSize: 64, fontWeight: 800, color: 'var(--text-3)', lineHeight: 1, margin: '0 0 12px' }}>404</p>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Pagina non trovata</h1>
      <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '0 0 28px' }}>L'indirizzo che hai cercato non esiste.</p>
      <Link to="/" className="btn-accent" style={{ textDecoration: 'none' }}>Torna alla panoramica</Link>
    </main>
  )
}
