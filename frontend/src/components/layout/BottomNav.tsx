import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Upload, Tag, Settings } from 'lucide-react'

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/transactions', icon: List, label: 'Transazioni' },
  { path: '/import', icon: Upload, label: 'Importa' },
  { path: '/categories', icon: Tag, label: 'Categorie' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white md:hidden">
      {nav.map(({ path, icon: Icon, label }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? 'text-indigo-600' : 'text-gray-500'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
