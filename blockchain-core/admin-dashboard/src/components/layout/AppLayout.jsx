import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '@/store/auth.store'
import NotificationDropdown from '@/components/notifications/NotificationDropdown'
import { authApi } from '@/services/api'

function parseEnvMinutes(value, fallbackMinutes) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMinutes
  return parsed
}

const IDLE_WARNING_MINUTES = parseEnvMinutes(import.meta.env.VITE_IDLE_WARNING_MINUTES, 10)
const rawIdleLogoutMinutes = parseEnvMinutes(import.meta.env.VITE_IDLE_LOGOUT_MINUTES, 15)
const IDLE_LOGOUT_MINUTES = Math.max(rawIdleLogoutMinutes, IDLE_WARNING_MINUTES + 1)

const IDLE_WARNING_MS = IDLE_WARNING_MINUTES * 60 * 1000
const IDLE_LOGOUT_MS = IDLE_LOGOUT_MINUTES * 60 * 1000

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.floor((IDLE_LOGOUT_MS - IDLE_WARNING_MS) / 1000)
  )

  const lastActivityRef = useRef(Date.now())
  const warningTimerRef = useRef(null)
  const logoutTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
  }, [])

  const performLogout = useCallback(async () => {
    clearTimers()
    setShowIdleWarning(false)
    try {
      await authApi.logout()
    } catch {}
    logout()
    navigate('/login', { replace: true })
  }, [clearTimers, logout, navigate])

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    countdownTimerRef.current = setInterval(() => {
      const msLeft = IDLE_LOGOUT_MS - (Date.now() - lastActivityRef.current)
      setSecondsRemaining(Math.max(0, Math.ceil(msLeft / 1000)))
    }, 1000)
  }, [])

  const scheduleIdleTimers = useCallback(() => {
    clearTimers()
    const elapsed = Date.now() - lastActivityRef.current
    const warningDelay = Math.max(0, IDLE_WARNING_MS - elapsed)
    const logoutDelay = Math.max(0, IDLE_LOGOUT_MS - elapsed)

    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true)
      startCountdown()
    }, warningDelay)

    logoutTimerRef.current = setTimeout(() => {
      performLogout()
    }, logoutDelay)
  }, [clearTimers, performLogout, startCountdown])

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (showIdleWarning) setShowIdleWarning(false)
    scheduleIdleTimers()
  }, [scheduleIdleTimers, showIdleWarning])

  useEffect(() => {
    scheduleIdleTimers()
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }))

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity))
      clearTimers()
    }
  }, [clearTimers, handleActivity, scheduleIdleTimers])

  const staySignedIn = () => {
    handleActivity()
  }

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

      {showIdleWarning && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,360px)] rounded-xl border border-brand-300 bg-white shadow-xl shadow-navy-900/25 p-4 print:hidden">
          <p className="text-sm font-semibold text-navy-900">Session timeout warning</p>
          <p className="mt-1 text-xs text-navy-600 leading-relaxed">
            You will be signed out due to inactivity in about {secondsRemaining}s.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={staySignedIn}
              className="btn-primary !py-1.5 !px-3"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={performLogout}
              className="btn-ghost !py-1.5 !px-3"
            >
              Sign out now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
