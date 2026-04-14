import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '@/store/auth.store'
import NotificationDropdown from '@/components/notifications/NotificationDropdown'

export default function AppLayout() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-surface-50 print:bg-white">
      <Sidebar />
      <div
        className="app-main-column"
        style={{ marginLeft: 'var(--sidebar-w)' }}
      >
        <header
          className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-navy-100 print:hidden"
          style={{ height: 'var(--header-h)' }}
        >
          <div className="h-full px-6 flex items-center justify-end">
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <div className="flex items-center gap-2.5 pl-2 border-l border-navy-100">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-navy-900 ring-2 ring-brand-400/35">
                  {user?.fullName?.charAt(0) || '?'}
                </div>
                <div className="hidden md:block">
                  <p className="text-xs font-medium text-navy-900 leading-tight">{user?.fullName}</p>
                  <p className="text-[11px] text-navy-500 leading-tight capitalize">{user?.role?.toLowerCase()}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="p-6 print:p-4"><Outlet /></main>
      </div>
    </div>
  )
}
