// =============================================================================
// TrustLedger - Loans Page
// Loan queue, approvals, rejections, disbursements, repayments
// =============================================================================

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Search, CheckCircle, XCircle, Banknote, RefreshCw,
  ArrowUpRight, Clock, Filter
} from 'lucide-react'
import { loansApi } from '@/services/api'
import { formatCurrency, formatDate, getApiError } from '@/utils/helpers'
import {
  Badge, Modal, Input, Textarea, Spinner,
  Alert, EmptyState, TableSkeleton, ConfirmDialog
} from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'

const STATUS_VARIANTS = {
  PENDING: 'pending', APPROVED: 'approved', DISBURSED: 'disbursed',
  REPAID: 'repaid', REJECTED: 'rejected', DEFAULTED: 'rejected'
}

// ── Approve Modal ─────────────────────────────────────────────────────────────
function ApproveModal({ open, onClose, loan }) {
  const qc = useQueryClient()
  const [error, setError] = useState(null)
  const { register, handleSubmit, reset } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => loansApi.approve(loan.loanId, data),
    onSuccess: () => { qc.invalidateQueries(['loans']); reset(); onClose() },
    onError: (err) => setError(getApiError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Approve Loan" size="sm">
      <div className="mb-4 p-3 bg-surface-50 rounded-xl text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-surface-500">Member</span>
          <span className="font-medium">{loan?.memberId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-surface-500">Amount</span>
          <span className="font-mono font-medium text-brand-700">{formatCurrency(loan?.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-surface-500">Monthly instalment</span>
          <span className="font-mono">{formatCurrency(loan?.monthlyInstalment)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-surface-500">Total repayable</span>
          <span className="font-mono">{formatCurrency(loan?.totalRepayable)}</span>
        </div>
      </div>
      {error && <div className="mb-3"><Alert type="error" onClose={() => setError(null)}>{error}</Alert></div>}
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Textarea label="Remarks (optional)" placeholder="Member is in good standing…" {...register('remarks')} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending && <Spinner size={14} />}
            <CheckCircle size={14} /> Approve Loan
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ open, onClose, loan }) {
  const qc = useQueryClient()
  const [error, setError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => loansApi.reject(loan.loanId, data),
    onSuccess: () => { qc.invalidateQueries(['loans']); reset(); onClose() },
    onError: (err) => setError(getApiError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Reject Loan Application" size="sm">
      {error && <div className="mb-3"><Alert type="error" onClose={() => setError(null)}>{error}</Alert></div>}
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Textarea
          label="Rejection reason *"
          placeholder="Insufficient savings history for the requested amount…"
          error={errors.reason?.message}
          {...register('reason', {
            required: 'Rejection reason is required',
            minLength: { value: 5, message: 'Please provide more detail' }
          })}
        />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-danger">
            {mutation.isPending && <Spinner size={14} />}
            <XCircle size={14} /> Reject
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Disburse Modal ────────────────────────────────────────────────────────────
function DisburseModal({ open, onClose, loan }) {
  const qc = useQueryClient()
  const [error, setError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => loansApi.disburse(loan.loanId, data),
    onSuccess: () => { qc.invalidateQueries(['loans']); reset(); onClose() },
    onError: (err) => setError(getApiError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Disburse Loan" size="sm">
      <Alert type="warning" className="mb-4">
        This action records the funds as sent to the member. Ensure payment has been made before proceeding.
      </Alert>
      {error && <div className="mb-3"><Alert type="error" onClose={() => setError(null)}>{error}</Alert></div>}
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Disbursement Reference *"
          placeholder="e.g. MM-AIRTEL-789456 or BANK-TXN-001"
          error={errors.disbursementRef?.message}
          {...register('disbursementRef', { required: 'Disbursement reference is required' })}
        />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending && <Spinner size={14} />}
            <Banknote size={14} /> Confirm Disbursement
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Repay Modal ───────────────────────────────────────────────────────────────
function RepayModal({ open, onClose, loan }) {
  const qc = useQueryClient()
  const [error, setError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { amount: loan?.monthlyInstalment, channel: 'TELLER' }
  })

  const mutation = useMutation({
    mutationFn: (data) => loansApi.repay(loan.loanId, { ...data, amount: Number(data.amount) }),
    onSuccess: () => { qc.invalidateQueries(['loans']); reset(); onClose() },
    onError: (err) => setError(getApiError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Record Repayment" size="sm">
      <div className="mb-4 p-3 bg-violet-50 rounded-xl text-sm border border-violet-100">
        <div className="flex justify-between mb-1">
          <span className="text-violet-600">Outstanding balance</span>
          <span className="font-mono font-semibold text-violet-800">{formatCurrency(loan?.outstandingBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-violet-500 text-xs">Monthly instalment</span>
          <span className="font-mono text-xs text-violet-700">{formatCurrency(loan?.monthlyInstalment)}</span>
        </div>
      </div>
      {error && <div className="mb-3"><Alert type="error" onClose={() => setError(null)}>{error}</Alert></div>}
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Amount (UGX)"
          type="number"
          min="1"
          error={errors.amount?.message}
          {...register('amount', { required: 'Amount required', min: { value: 1, message: 'Must be positive' } })}
        />
        <Input
          label="Payment Reference"
          placeholder="MOMO-REF-12345"
          error={errors.reference?.message}
          {...register('reference', { required: 'Reference required' })}
        />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending && <Spinner size={14} />}
            Record Repayment
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Loans Page ───────────────────────────────────────────────────────────
export default function LoansPage() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('ALL')
  const [modal, setModal]         = useState(null) // { type, loan }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loans', statusFilter],
    queryFn:  () => loansApi.getAll(statusFilter !== 'ALL' ? { status: statusFilter } : {})
                      .then(r => r.data.data),
  })

  const loans = Array.isArray(data) ? data : []

  const filtered = useMemo(() => {
    if (!search) return loans
    return loans.filter(l =>
      l.memberId?.toLowerCase().includes(search.toLowerCase()) ||
      l.loanId?.toLowerCase().includes(search.toLowerCase())
    )
  }, [loans, search])

  const openModal = (type, loan) => setModal({ type, loan })
  const closeModal = () => setModal(null)

  const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'DISBURSED', 'REPAID', 'REJECTED']

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Loans</h1>
          <p className="page-subtitle">{filtered.length} loan records (live from the API)</p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by member ID or loan ID…"
            className="input pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-navy-950'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}>
              {s === 'ALL' ? 'All Loans' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Clock} title="No loans found"
            description={statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} loans.` : 'No loan applications yet.'} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Member</th>
                <th>Amount</th>
                <th>Term</th>
                <th>Outstanding</th>
                <th>Applied</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(loan => (
                <tr key={loan.loanId}>
                  <td>
                    <Link to={`/loans/${loan.loanId}`}
                          className="font-mono text-xs text-brand-600 hover:underline">
                      {loan.loanId?.slice(-14)}
                    </Link>
                  </td>
                  <td className="font-medium text-surface-800">{loan.memberId}</td>
                  <td className="font-mono text-sm">{formatCurrency(loan.amount, true)}</td>
                  <td className="text-surface-500">{loan.termMonths}mo</td>
                  <td>
                    <span className={`font-mono text-sm ${
                      loan.outstandingBalance > 0 ? 'text-violet-600' : 'text-surface-400'
                    }`}>
                      {formatCurrency(loan.outstandingBalance, true)}
                    </span>
                  </td>
                  <td className="text-surface-400">{formatDate(loan.appliedAt)}</td>
                  <td>
                    <Badge variant={STATUS_VARIANTS[loan.status] || 'default'}>{loan.status}</Badge>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex items-center gap-1">
                        {loan.status === 'PENDING' && (
                          <>
                            <button onClick={() => openModal('approve', loan)}
                              className="btn-sm btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0">
                              <CheckCircle size={12} /> Approve
                            </button>
                            <button onClick={() => openModal('reject', loan)}
                              className="btn-sm btn bg-red-50 text-red-600 hover:bg-red-100 border-0">
                              <XCircle size={12} /> Reject
                            </button>
                          </>
                        )}
                        {loan.status === 'APPROVED' && (
                          <button onClick={() => openModal('disburse', loan)}
                            className="btn-sm btn bg-violet-50 text-violet-700 hover:bg-violet-100 border-0">
                            <Banknote size={12} /> Disburse
                          </button>
                        )}
                        {loan.status === 'DISBURSED' && (
                          <button onClick={() => openModal('repay', loan)}
                            className="btn-sm btn bg-navy-50 text-navy-800 hover:bg-navy-100 border-0">
                            <ArrowUpRight size={12} /> Repay
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'approve'  && <ApproveModal  open onClose={closeModal} loan={modal.loan} />}
      {modal?.type === 'reject'   && <RejectModal   open onClose={closeModal} loan={modal.loan} />}
      {modal?.type === 'disburse' && <DisburseModal open onClose={closeModal} loan={modal.loan} />}
      {modal?.type === 'repay'    && <RepayModal    open onClose={closeModal} loan={modal.loan} />}
    </div>
  )
}
