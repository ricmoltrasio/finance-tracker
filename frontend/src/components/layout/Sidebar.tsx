import { NavLink } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { path: '/', icon: 'overview', label: 'Panoramica' },
  { path: '/transactions', icon: 'list', label: 'Transazioni' },
  { path: '/budget', icon: 'wallet', label: 'Budget' },
  { path: '/import', icon: 'upload', label: 'Importa' },
  { path: '/settings', icon: 'settings', label: 'Impostazioni' },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const email = user?.email ?? ''
  const initials = email.slice(0, 2).toUpperCase() || 'FT'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="coin" size={18} stroke={2} />
        </div>
        <span className="brand-name">Finance Tracker</span>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            end={n.path === '/'}
            className={({ isActive }) => 'navitem' + (isActive ? ' on' : '')}
          >
            <Icon name={n.icon} size={19} stroke={1.8} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-foot">
        <div className="user" style={{ marginBottom: 4 }}>
          <div className="avatar">{initials}</div>
          <div className="user-meta">
            <span className="user-name">{email || 'Utente'}</span>
            <span className="user-sub">Account</span>
          </div>
        </div>
        <button className="navitem" style={{ width: '100%' }} onClick={() => signOut()}>
          <Icon name="logout" size={19} stroke={1.8} />
          <span>Esci</span>
        </button>
      </div>
    </aside>
  )
}
