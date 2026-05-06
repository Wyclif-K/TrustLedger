import React, { useState, useRef, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Landmark,
  Eye,
  EyeOff,
  Lock,
  Mail,
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
    <div className="min-h-screen w-full bg-navy-950">
      <div className="w-full min-h-screen bg-surface-100 overflow-hidden flex flex-col lg:flex-row">
        {/* Left panel */}
        <aside className="relative lg:w-[44%] bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950 text-white px-8 py-10 sm:px-10 sm:py-12 overflow-hidden">
          <div
            className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-brand-500"
            aria-hidden
          />
          <div
            className="absolute top-28 -right-24 w-56 h-56 rounded-full bg-brand-400"
            aria-hidden
          />
          <div
            className="absolute -bottom-20 left-8 w-52 h-52 rounded-full bg-brand-600"
            aria-hidden
          />
          <div
            className="absolute -bottom-14 -right-10 w-32 h-32 rounded-full bg-brand-300"
            aria-hidden
          />
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="relative z-20 inline-flex items-center gap-3 bg-navy-900/80 rounded-xl px-3 py-2 border border-white/15 shadow-lg shadow-black/25">
              <div className="w-11 h-11 rounded-xl bg-brand-500 text-navy-900 flex items-center justify-center shadow-md ring-2 ring-white/20">
                <Landmark size={22} aria-hidden />
              </div>
              <div>
                <p className="font-display text-[28px] leading-tight text-white">TrustLedger</p>
                <p className="text-xs tracking-[0.16em] uppercase text-white/90">SACCO Administration</p>
              </div>
            </div>

            <div className="relative z-20 max-w-[320px] space-y-3 bg-navy-950/70 border border-white/15 rounded-2xl px-5 py-4 shadow-lg shadow-black/30">
              <h2 className="font-display text-2xl leading-tight text-white">
                Ledger-backed savings &amp; loans in one place.
              </h2>
              <p className="text-sm text-white/95 leading-relaxed">
                Monitor members, approve loans, and reconcile balances against your Hyperledger Fabric network.
              </p>
            </div>
          </div>
        </aside>

        {/* Right panel */}
        <section className="lg:w-[56%] px-6 py-8 sm:px-10 sm:py-10 flex items-center justify-center bg-surface-100">
          <div className="w-full max-w-md bg-surface-50 border border-navy-200 rounded-xl p-6 sm:p-7 shadow-sm">
            <h1 className="text-[38px] leading-none font-medium text-navy-900 font-sans mb-2">sign in</h1>
            <p className="text-xs text-navy-500 mb-7">Sign in to your admin account to continue.</p>

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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
              <div>
                <label className="label !mb-2 !text-navy-700 !tracking-normal !uppercase" htmlFor={emailId}>
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
                    className={`pl-10 py-2.5 !rounded-md ${errors.email ? 'input-error' : 'input'}`}
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
                <label className="label !mb-2 !text-navy-700 !tracking-normal !uppercase" htmlFor={passwordId}>
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
                    placeholder="Enter password"
                    className={`pl-10 pr-20 py-2.5 !rounded-md ${errors.password ? 'input-error' : 'input'}`}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={errors.password ? passwordErrorId : undefined}
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide text-navy-500 hover:text-navy-700 rounded px-1.5 py-1 inline-flex items-center justify-center gap-1"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    aria-pressed={showPass}
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && (
                  <p id={passwordErrorId} className="text-xs text-red-600 mt-1.5" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-navy-900 hover:bg-navy-950 text-white font-medium rounded-md py-2.5 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSubmitting && <Spinner size={18} className="text-white" />}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-[11px] text-navy-500 text-center mt-8">
              Need access? Contact your SACCO administrator.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
