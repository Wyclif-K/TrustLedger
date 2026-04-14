import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, BarChart3, LogOut, ShieldCheck, Landmark, ChevronRight, Radio,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/api'

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members',       icon: Users,           label: 'Members' },
  { to: '/loans',         icon: CreditCard,      label: 'Loans' },
  { to: '/reports',       icon: BarChart3,       label: 'Reports' },
  { to: '/audit',         icon: ShieldCheck,     label: 'Audit Trail' },
  { to: '/integrations',  icon: Radio,           label: 'Integrations' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout(); navigate('/login')
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-navy-100 flex flex-col z-30 shadow-sm print:hidden"
      style={{ width: 'var(--sidebar-w)' }}
    >
      <div className="px-5 py-5 bg-gradient-to-br from-navy-900 to-navy-950 text-white border-b border-navy-800">
        <div className="h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 mb-4" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md ring-2 ring-brand-400/30">
            <Landmark size={18} className="text-navy-950" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">TrustLedger</p>
            <p className="text-[11px] text-brand-200/90 leading-tight">SACCO Management</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto bg-surface-50/50">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-navy-400">Navigation</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            isActive ? 'bg-brand-50 text-navy-900 shadow-sm' : 'text-navy-600 hover:text-navy-900 hover:bg-white'
          )}>
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-brand-600' : 'text-navy-400'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-brand-500" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4 space-y-1 border-t border-navy-100 pt-3 bg-white">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-50 border border-navy-100/80">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-navy-900 shrink-0 ring-2 ring-brand-400/40">
            {user?.fullName?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-navy-900 truncate">{user?.fullName || 'User'}</p>
            <p className="text-[11px] text-navy-500 capitalize truncate">{user?.role?.toLowerCase()}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-500 hover:text-red-600 hover:bg-red-50 transition-all">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  )
}
