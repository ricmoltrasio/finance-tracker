import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Upload, Tag, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const nav = [
  { path: '/', icon: LayoutDashboard, label: 'Panoramica' },
  { path: '/transactions', icon: List, label: 'Transazioni' },
  { path: '/import', icon: Upload, label: 'Importa' },
  { path: '/categories', icon: Tag, label: 'Categorie' },
  { path: '/settings', icon: Settings, label: 'Impostazioni' },
]

export function Sidebar() {
  const { signOut } = useAuth()

  return (
    <aside className="hidden md:flex w-56 flex-col bg-gray-900 text-gray-300">
      <div className="px-5 py-6">
        <span className="text-base font-semibold text-white">Finance Tracker</span>
      </div>

      <nav className="flex-1 px-3">
        {nav.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors mb-0.5 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Esci
        </button>
      </div>
    </aside>
  )
}
