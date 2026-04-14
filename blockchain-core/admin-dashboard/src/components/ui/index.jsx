import React from 'react'
import { Loader2, X, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import clsx from 'clsx'

export function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={clsx('animate-spin', className)} />
}
export function Badge({ children, variant = 'default', className = '' }) {
  const v = { default:'bg-surface-100 text-surface-600', active:'bg-emerald-50 text-emerald-700 border border-emerald-200', pending:'bg-amber-50 text-amber-700 border border-amber-200', approved:'bg-navy-50 text-navy-800 border border-navy-200', disbursed:'bg-violet-50 text-violet-700 border border-violet-200', repaid:'bg-emerald-50 text-emerald-700 border border-emerald-200', rejected:'bg-red-50 text-red-700 border border-red-200', suspended:'bg-orange-50 text-orange-700 border border-orange-200' }
  return <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', v[variant]||v.default, className)}>{children}</span>
}
export function Alert({ type = 'info', children, onClose, className = '' }) {
  const s = { info:{cls:'bg-navy-50 border-navy-200 text-navy-900',Icon:Info}, success:{cls:'bg-emerald-50 border-emerald-200 text-emerald-800',Icon:CheckCircle2}, error:{cls:'bg-red-50 border-red-200 text-red-800',Icon:XCircle}, warning:{cls:'bg-amber-50 border-amber-200 text-amber-800',Icon:AlertCircle} }
  const { cls, Icon } = s[type]||s.info
  return (
    <div className={clsx('flex items-start gap-3 p-4 rounded-xl border text-sm', cls, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" /><p className="flex-1">{children}</p>
      {onClose && <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>}
    </div>
  )
}
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative w-full bg-white rounded-2xl shadow-2xl animate-slide-up border border-surface-200 overflow-hidden', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="text-base font-semibold text-surface-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
export const Input = React.forwardRef(function Input({ label, error, hint, className = '', ...props }, ref) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <input ref={ref} className={clsx(error ? 'input-error' : 'input', className)} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-400 mt-1">{hint}</p>}
    </div>
  )
})
export const Select = React.forwardRef(function Select({ label, error, options = [], className = '', ...props }, ref) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <select ref={ref} className={clsx('input', className)} {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
})
export const Textarea = React.forwardRef(function Textarea({ label, error, className = '', ...props }, ref) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <textarea ref={ref} rows={3} className={clsx('input resize-none', className)} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
})
export function StatCard({ label, value, sub, icon: Icon, trend, color = 'brand', className = '' }) {
  const colors = { brand:'bg-brand-50 text-brand-700', emerald:'bg-emerald-50 text-emerald-600', amber:'bg-amber-50 text-amber-600', violet:'bg-violet-50 text-violet-600', red:'bg-red-50 text-red-600', blue:'bg-navy-50 text-navy-700' }
  return (
    <div className={clsx('stat-card animate-slide-up', className)}>
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-xl', colors[color]||colors.brand)}>{Icon && <Icon size={18} />}</div>
        {trend !== undefined && <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>{trend >= 0 ? '+' : ''}{trend}%</span>}
      </div>
      <div>
        <p className="text-2xl font-semibold text-navy-900 font-mono">{value}</p>
        <p className="text-sm text-surface-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-surface-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-4"><Icon size={24} className="text-surface-400" /></div>}
      <h3 className="text-base font-semibold text-surface-700">{title}</h3>
      {description && <p className="text-sm text-surface-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-surface-100">
          {Array.from({ length: cols }).map((_, j) => <div key={j} className="h-4 bg-surface-100 rounded flex-1" />)}
        </div>
      ))}
    </div>
  )
}
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-surface-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className={clsx('btn', variant === 'danger' ? 'btn-danger' : 'btn-primary')}>
          {loading && <Spinner size={14} />}{confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
