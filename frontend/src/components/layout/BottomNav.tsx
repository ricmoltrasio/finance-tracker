import { NavLink } from 'react-router-dom'
import { Icon } from '../common/Icon'

const NAV = [
  { path: '/', icon: 'overview', label: 'Home' },
  { path: '/transactions', icon: 'list', label: 'Movimenti' },
  { path: '/budget', icon: 'wallet', label: 'Budget' },
  { path: '/import', icon: 'upload', label: 'Importa' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="bottomnav">
      {NAV.map((n) => (
        <NavLink
          key={n.path}
          to={n.path}
          end={n.path === '/'}
          className={({ isActive }) => 'bnav' + (isActive ? ' on' : '')}
        >
          <Icon name={n.icon} size={21} stroke={1.8} />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
