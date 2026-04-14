// =============================================================================
// Header notification bell + panel (TrustLedger admin)
// =============================================================================

import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BellRing,
  CheckCheck,
  CreditCard,
  Landmark,
  PiggyBank,
  CalendarClock,
  Info,
  ArrowDownRight,
  X,
} from 'lucide-react'
import { notificationsApi } from '@/services/api'
import { timeAgo } from '@/utils/helpers'
import clsx from 'clsx'
import { useAuthStore } from '@/store/auth.store'

const TYPE_META = {
  DEPOSIT:           { icon: PiggyBank,   color: 'text-emerald-600 bg-emerald-50' },
  WITHDRAWAL:        { icon: ArrowDownRight, color: 'text-amber-600 bg-amber-50' },
  LOAN_APPROVED:     { icon: CheckCheck,  color: 'text-navy-800 bg-navy-50' },
  LOAN_REJECTED:     { icon: X,           color: 'text-red-600 bg-red-50' },
  LOAN_DISBURSED:    { icon: Landmark,    color: 'text-violet-600 bg-violet-50' },
  LOAN_REPAYMENT:    { icon: CreditCard,  color: 'text-teal-600 bg-teal-50' },
  LOAN_DUE_REMINDER: { icon: CalendarClock, color: 'text-orange-600 bg-orange-50' },
  GENERAL:           { icon: Info,        color: 'text-surface-600 bg-surface-100' },
}

function TypeIcon({ type }) {
  const meta = TYPE_META[type] || TYPE_META.GENERAL
  const Icon = meta.icon
  return (
    <div className={clsx('shrink-0 w-9 h-9 rounded-xl flex items-center justify-center', meta.color)}>
      <Icon size={18} strokeWidth={2} />
    </div>
  )
}

export default function NotificationDropdown() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canViewSaccoScope = ['ADMIN', 'AUDITOR', 'SUPER_ADMIN'].includes(user?.role)
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState('mine') // 'mine' | 'all'
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const panelRef = useRef(null)

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications-unread', scope],
    queryFn:  () => notificationsApi.unreadCount({ scope }).then((r) => r.data.data),
    refetchInterval: open ? 15_000 : 60_000,
  })
  const unread = unreadData?.count ?? 0

  const unreadOnly = filter === 'unread'
  const { data: items = [], isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ['notifications-list', scope, filter],
    queryFn:  () =>
      notificationsApi
        .list({ limit: 25, unreadOnly: unreadOnly || undefined, scope })
        .then((r) => r.data.data),
    enabled: open,
  })

  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
      qc.invalidateQueries({ queryKey: ['notifications-list'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
      qc.invalidateQueries({ queryKey: ['notifications-list'] })
    },
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openPanel = () => {
    setOpen(true)
    refetchUnread()
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={clsx(
          'relative p-2 rounded-xl transition-colors',
          open
            ? 'text-brand-700 bg-brand-50'
            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'
        )}
      >
        {unread > 0 ? <BellRing size={18} className="text-brand-600" /> : <Bell size={18} />}
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-brand-600 rounded-full ring-2 ring-white shadow-sm">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,28rem)] flex flex-col rounded-2xl border border-surface-200/80 bg-white shadow-xl shadow-surface-900/10 z-50 animate-slide-up"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-surface-900">Notifications</h2>
              <p className="text-[11px] text-surface-500 mt-0.5">
                {unread > 0 ? `${unread} unread` : 'You are all caught up'}
              </p>
            </div>
            <button
              type="button"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-lg hover:bg-brand-50"
            >
              Mark all read
            </button>
          </div>

          <div className="px-3 pt-2 pb-1 flex gap-1">
            {canViewSaccoScope && (
              <>
                {[
                  { id: 'mine', label: 'Mine' },
                  { id: 'all', label: 'SACCO' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScope(s.id)}
                    className={clsx(
                      'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                      scope === s.id
                        ? 'bg-brand-600 text-white'
                        : 'text-surface-600 hover:bg-surface-100'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="px-3 pt-1 pb-1 flex gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  filter === t.id
                    ? 'bg-surface-900 text-white'
                    : 'text-surface-600 hover:bg-surface-100'
                )}
              >
                {t.label}
                {t.id === 'unread' && unread > 0 && (
                  <span className="ml-1 opacity-80">({unread})</span>
                )}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {listLoading ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                <p className="text-xs text-surface-500">Loading…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
                  <Bell size={22} className="text-surface-400" />
                </div>
                <p className="text-sm font-medium text-surface-700">No notifications</p>
                <p className="text-xs text-surface-500 mt-1">
                  {filter === 'unread'
                    ? 'No unread items — switch to All or check back later.'
                    : 'Loan updates and savings activity will appear here.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-100 pb-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={clsx(
                        'w-full text-left px-3 py-3 flex gap-3 hover:bg-surface-50/90 transition-colors',
                        !n.isRead && 'bg-brand-50/50'
                      )}
                      onClick={() => {
                        if (!n.isRead) markRead.mutate(n.id)
                      }}
                    >
                      <TypeIcon type={n.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-surface-900 leading-snug">{n.title}</p>
                          {!n.isRead && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-brand-500 mt-1" title="Unread" />
                          )}
                        </div>
                        <p className="text-[11px] text-surface-600 mt-1 leading-relaxed line-clamp-3">{n.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-400">
                          <span>{timeAgo(n.createdAt)}</span>
                          {scope === 'all' && canViewSaccoScope && n.memberId && (
                            <>
                              <span className="text-surface-300">·</span>
                              <span>{n.memberId}</span>
                            </>
                          )}
                          {n.channel && n.channel !== 'IN_APP' && (
                            <span className="text-surface-300">·</span>
                          )}
                          {n.channel && n.channel !== 'IN_APP' && <span>{n.channel}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="px-3 py-2 border-t border-surface-100 bg-surface-50/80 rounded-b-2xl">
              <button
                type="button"
                className="w-full text-center text-[11px] font-medium text-surface-500 hover:text-brand-600 py-1"
                onClick={() => refetchList()}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
