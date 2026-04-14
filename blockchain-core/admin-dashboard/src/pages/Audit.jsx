// =============================================================================
// TrustLedger - Audit Trail Page
// Auditors verify ledger integrity and explore immutable transaction history
// =============================================================================

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  ShieldCheck, AlertTriangle, Search, CheckCircle2, XCircle
} from 'lucide-react'
import { membersApi } from '@/services/api'
import { formatCurrency, formatDateTime, getApiError } from '@/utils/helpers'
import { Alert, Spinner, EmptyState, TableSkeleton } from '@/components/ui'

// ── Balance Verifier ──────────────────────────────────────────────────────────
function BalanceVerifier() {
  const [result, setResult] = useState(null)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const mutation = useMutation({
    mutationFn: ({ memberId }) =>
      membersApi.verifyBalance(memberId).then(r => r.data.data),
    onSuccess: (data) => setResult(data),
    onError: (err) => setResult({ error: getApiError(err) }),
  })

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-surface-800">Balance Integrity Verifier</h3>
      </div>
      <p className="text-xs text-surface-500 mb-4">
        Recalculates a member's balance from all blockchain transactions and compares it
        against the stored balance. Any discrepancy indicates potential tampering.
      </p>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex gap-3">
        <div className="flex-1">
          <input
            placeholder="Enter Member ID (e.g. MEM001)"
            className={errors.memberId ? 'input-error' : 'input'}
            {...register('memberId', { required: 'Member ID required' })}
          />
        </div>
        <button type="submit" disabled={mutation.isPending} className="btn-primary shrink-0">
          {mutation.isPending ? <Spinner size={14} /> : <Search size={14} />}
          Verify
        </button>
      </form>

      {result && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${
          result.error
            ? 'bg-red-50 border-red-200'
            : result.isBalanced
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
        }`}>
          {result.error ? (
            <div className="flex items-center gap-2 text-red-700">
              <XCircle size={15} /> {result.error}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                {result.isBalanced
                  ? <><CheckCircle2 size={15} className="text-emerald-600" /><span className="text-emerald-700">Balance VERIFIED — No discrepancies found</span></>
                  : <><AlertTriangle size={15} className="text-red-600" /><span className="text-red-700">DISCREPANCY DETECTED — Requires investigation</span></>
                }
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                {[
                  ['Member ID', result.memberId],
                  ['Stored Balance', formatCurrency(result.storedBalance)],
                  ['Computed Balance', formatCurrency(result.computedBalance)],
                  ['Discrepancy', formatCurrency(result.discrepancy)],
                  ['Transactions Checked', result.txCount],
                  ['Status', result.status],
                  ['Verified At', formatDateTime(result.verifiedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-surface-500">{label}</p>
                    <p className={`font-medium mt-0.5 ${
                      label === 'Discrepancy' && result.discrepancy !== 0 ? 'text-red-600 font-mono' :
                      label === 'Stored Balance' || label === 'Computed Balance' ? 'font-mono text-surface-800' :
                      'text-surface-800'
                    }`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Savings History Viewer ────────────────────────────────────────────────────
function SavingsHistoryViewer() {
  const [memberId, setMemberId] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['savings-history', submitted],
    queryFn:  () => membersApi.getHistory(submitted).then(r => r.data.data),
    enabled:  !!submitted,
  })

  const history = Array.isArray(data) ? data : []

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-surface-100">
        <h3 className="text-sm font-semibold text-surface-800">Savings Account History</h3>
        <p className="text-xs text-surface-400 mt-0.5">
          Immutable chronological record of all changes to a member's savings account on the blockchain.
        </p>
      </div>
      <div className="p-5">
        <div className="flex gap-3 mb-4">
          <input
            value={memberId}
            onChange={e => setMemberId(e.target.value)}
            placeholder="Member ID (e.g. MEM001)"
            className="input flex-1"
          />
          <button
            onClick={() => setSubmitted(memberId)}
            disabled={!memberId}
            className="btn-secondary shrink-0"
          >
            Load History
          </button>
        </div>

        {error && <Alert type="error">{getApiError(error)}</Alert>}

        {isLoading && <TableSkeleton rows={5} cols={4} />}

        {!isLoading && submitted && history.length === 0 && (
          <EmptyState icon={ShieldCheck} title="No history found" description="Check the member ID and try again." />
        )}

        {history.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-surface-500 mb-3">{history.length} state changes recorded</p>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3.5 top-4 bottom-4 w-px bg-surface-200" />
              <div className="space-y-3">
                {history.map((entry, i) => (
                  <div key={entry.txId || i} className="flex gap-4 relative">
                    <div className="w-7 h-7 rounded-full bg-white border-2 border-brand-300 flex items-center justify-center z-10 shrink-0">
                      <span className="text-[10px] font-bold text-brand-600">{history.length - i}</span>
                    </div>
                    <div className="flex-1 card p-3 mb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-surface-500">{entry.txId?.slice(0,24)}…</p>
                          <p className="text-xs text-surface-400 mt-0.5">{formatDateTime(entry.timestamp)}</p>
                        </div>
                        {entry.isDelete && (
                          <span className="badge-rejected text-[10px] px-2 py-0.5">Deleted</span>
                        )}
                      </div>
                      {entry.value && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs border-t border-surface-100 pt-2">
                          <div>
                            <p className="text-surface-400">Balance</p>
                            <p className="font-mono font-medium text-surface-800">{formatCurrency(entry.value.balance)}</p>
                          </div>
                          <div>
                            <p className="text-surface-400">Deposited</p>
                            <p className="font-mono text-emerald-600">{formatCurrency(entry.value.totalDeposited, true)}</p>
                          </div>
                          <div>
                            <p className="text-surface-400">Withdrawn</p>
                            <p className="font-mono text-red-500">{formatCurrency(entry.value.totalWithdrawn, true)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Audit Page ───────────────────────────────────────────────────────────
export default function AuditPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-subtitle">Blockchain immutability verification and ledger inspection (live API reads)</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">
          <ShieldCheck size={13} className="text-emerald-600" />
          Hyperledger Fabric — immutable ledger
        </div>
      </div>

      {/* Info banner */}
      <Alert type="info">
        All data on this page is read directly from the Hyperledger Fabric blockchain.
        Transaction records cannot be modified or deleted after being committed.
        Use the verifier below to confirm no discrepancies exist between computed and stored balances.
      </Alert>

      {/* Balance verifier */}
      <BalanceVerifier />

      {/* Savings history */}
      <SavingsHistoryViewer />
    </div>
  )
}
