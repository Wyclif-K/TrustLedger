import React, { useState, useRef, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Landmark,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  Mail,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth.store'
import { getApiError } from '@/utils/helpers'
import { Spinner } from '@/components/ui'

/**
 * Avoid leaking whether an account exists. Still surface validation (422) and outages (5xx).
 */
function getLoginErrorMessage(err) {
  if (!err?.response) {
    return getApiError(err) || 'Could not reach the server. Check your connection and try again.'
  }
  const status = err.response.status
  if (status === 422) return getApiError(err)
  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again shortly.'
  }
  return 'Could not sign in. Check your email and password, then try again.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const formId = useId()
  const emailId = `${formId}-email`
  const passwordId = `${formId}-password`
  const emailErrorId = `${formId}-email-error`
  const passwordErrorId = `${formId}-password-error`
  const formErrorId = `${formId}-form-error`

  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState(null)
  const formErrorRef = useRef(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    if (error && formErrorRef.current) {
      formErrorRef.current.focus()
    }
  }, [error])

  const onSubmit = async (data) => {
    setError(null)
    try {
      const res = await authApi.login({
        email: String(data.email).trim().toLowerCase(),
        password: data.password,
      })
      setAuth(res.data.data.user, res.data.data.accessToken)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getLoginErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col lg:flex-row overflow-hidden">
      {/* Page backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-[#0c2138]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div
        className="absolute -top-32 -right-32 w-[min(80vw,520px)] h-[min(80vw,520px)] rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(255,180,0,0.35) 0%, transparent 70%)' }}
        aria-hidden
      />
      <div
        className="absolute bottom-0 left-0 w-[min(100vw,640px)] h-64 opacity-30 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(11,27,50,0.9), transparent)',
        }}
        aria-hidden
      />

      {/* Brand / story — desktop */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between p-12 xl:p-14 text-white">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/40 ring-2 ring-white/10">
              <Landmark size={24} className="text-navy-950" aria-hidden />
            </div>
            <div>
              <p className="font-display text-2xl tracking-tight">TrustLedger</p>
              <p className="text-sm text-white/65">SACCO Administration</p>
            </div>
          </div>
          <h2 className="font-display text-3xl xl:text-4xl leading-tight text-white/95 max-w-md">
            Ledger-backed savings &amp; loans in one place.
          </h2>
          <p className="mt-4 text-base text-white/70 max-w-md leading-relaxed">
            Monitor members, approve loans, and reconcile balances against your Hyperledger Fabric
            network.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/75 max-w-sm">
          {[
            'Immutable transaction history on-chain',
            'Role-based access for staff and auditors',
            'Real-time health of API and Fabric peers',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Sparkles size={16} className="text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Form column */}
      <div className="relative flex flex-1 items-center justify-center p-5 sm:p-8 lg:p-10">
        <div className="w-full max-w-[440px] animate-slide-up">
          <div className="rounded-2xl shadow-2xl shadow-navy-950/40 overflow-hidden border border-white/90 bg-white">
            <div className="h-1.5 bg-gradient-to-r from-brand-500 via-brand-600 to-navy-800" aria-hidden />

            <div className="px-6 sm:px-8 pt-7 pb-2 lg:hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md ring-2 ring-brand-400/30">
                  <Landmark size={22} className="text-navy-950" aria-hidden />
                </div>
                <div>
                  <h1 className="font-display text-xl text-navy-900 leading-tight">TrustLedger</h1>
                  <p className="text-xs text-navy-600">SACCO Administration</p>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-8 pb-7 pt-2 lg:pt-8">
              <h2 className="text-xl font-semibold text-navy-900 mb-1 font-sans">Welcome back</h2>
              <p className="text-sm text-navy-600 mb-2">Sign in to your admin account</p>
              <p className="text-xs text-navy-500 mb-5">
                Need access? Contact your SACCO administrator.
              </p>

              {error && (
                <div
                  ref={formErrorRef}
                  id={formErrorId}
                  role="alert"
                  tabIndex={-1}
                  className="mb-5 p-3.5 bg-red-950/5 border border-red-200/90 rounded-xl text-xs text-red-800 flex items-start gap-2 outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
                >
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" aria-hidden />
                  <span className="flex-1 leading-relaxed">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 text-red-400 hover:text-red-600 rounded-md px-1 py-0.5"
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="rounded-xl border border-navy-100 bg-white p-4 sm:p-5 space-y-4">
                  <div>
                    <label className="label" htmlFor={emailId}>
                      Email address
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"
                        aria-hidden
                      />
                      <input
                        id={emailId}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="admin@trustledger.com"
                        className={`pl-10 ${errors.email ? 'input-error' : 'input'} bg-white`}
                        aria-invalid={errors.email ? 'true' : 'false'}
                        aria-describedby={errors.email ? emailErrorId : undefined}
                        {...register('email', { required: 'Email is required' })}
                      />
                    </div>
                    {errors.email && (
                      <p id={emailErrorId} className="text-xs text-red-600 mt-1.5" role="alert">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label" htmlFor={passwordId}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"
                        aria-hidden
                      />
                      <input
                        id={passwordId}
                        type={showPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={`pl-10 pr-11 ${errors.password ? 'input-error' : 'input'} bg-white`}
                        aria-invalid={errors.password ? 'true' : 'false'}
                        aria-describedby={errors.password ? passwordErrorId : undefined}
                        {...register('password', { required: 'Password is required' })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700 rounded-md p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        aria-pressed={showPass}
                      >
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p id={passwordErrorId} className="text-xs text-red-600 mt-1.5" role="alert">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full justify-center py-3 rounded-xl shadow-md shadow-brand-900/15 border border-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isSubmitting && <Spinner size={18} className="text-navy-950" />}
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>

            <div className="px-6 sm:px-8 py-3.5 bg-white border-t border-navy-100">
              <div className="flex items-center justify-center gap-2 text-xs text-navy-600 text-center">
                <ShieldCheck size={14} className="text-brand-600 shrink-0" aria-hidden />
                <span>Secured session; ledger data is backed by Hyperledger Fabric.</span>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-white/45 mt-6">TrustLedger SACCO v1.0</p>
        </div>
      </div>
    </div>
  )
}
