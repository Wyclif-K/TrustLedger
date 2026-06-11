// =============================================================================
// TrustLedger - Pending Member Requests
// Savings deposits and loan repayments awaiting admin approval
// =============================================================================

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, RefreshCw, Clock, PiggyBank, CreditCard } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { memberRequestsApi } from '@/services/api'
import { formatCurrency, formatDateTime, getApiError } from '@/utils/helpers'
import {
  Badge, Modal, Textarea, Spinner, Alert, EmptyState, TableSkeleton, ConfirmDialog,
} from '@/components/ui'

const TYPE_LABELS = {
  SAVINGS_DEPOSIT: 'Savings deposit',
  LOAN_REPAYMENT:  'Loan repayment',
}

function RejectModal({ open, onClose, request }) {
  const qc = useQueryClient()
  const [error, setError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => memberRequestsApi.reject(request.id, data),
    onSuccess: () => { qc.invalidateQueries(['member-requests']); reset(); onClose() },
    onError: (err) => setError(getApiError(err)),
  })

  return (
    <Modal open={open} onClose={onClose} title="Reject request" size="sm">
      {error && <div className="mb-3"><Alert type="error" onClose={() => setError(null)}>{error}</Alert></div>}
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Textarea
          label="Rejection reason *"
          placeholder="Payment not received at branch…"
          error={errors.reason?.message}
          {...register('reason', {
            required: 'Reason is required',
            minLength: { value: 5, message: 'Please provide more detail' },
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

export default function PendingRequestsPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [actionError, setActionError] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['member-requests', statusFilter],
    queryFn: () => memberRequestsApi.list({ status: statusFilter }).then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: (id) => memberRequestsApi.approve(id),
    onSuccess: () => { qc.invalidateQueries(['member-requests']); setApproveTarget(null); setActionError(null) },
    onError: (err) => setActionError(getApiError(err)),
  })

  const rows = Array.isArray(data) ? data : []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending requests</h1>
          <p className="page-subtitle">
            Member savings and repayments submitted via USSD or mobile app — approve to record on blockchain
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {actionError && <Alert type="error" onClose={() => setActionError(null)}>{actionError}</Alert>}
      {isError && <Alert type="error">{getApiError(error)}</Alert>}

      <div className="flex flex-wrap gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={statusFilter === s ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No requests"
            description={statusFilter === 'PENDING'
              ? 'When members submit savings or repayments, they appear here for approval.'
              : 'No requests match this filter.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Channel</th>
                  <th>Reference</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  {statusFilter === 'PENDING' && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-surface-800">{r.fullName || r.memberId}</div>
                      <div className="text-xs text-surface-400 font-mono">{r.memberId}</div>
                      {r.metadata?.loanId && (
                        <div className="text-xs text-surface-500">Loan: {r.metadata.loanId.slice(-12)}</div>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-sm">
                        {r.type === 'SAVINGS_DEPOSIT'
                          ? <PiggyBank size={14} className="text-emerald-600" />
                          : <CreditCard size={14} className="text-violet-600" />}
                        {TYPE_LABELS[r.type] || r.type}
                      </span>
                    </td>
                    <td className="font-mono font-medium">{formatCurrency(r.amount)}</td>
                    <td><Badge variant="default">{r.channel}</Badge></td>
                    <td className="font-mono text-xs text-surface-500">{r.reference?.slice(-16)}</td>
                    <td className="text-sm text-surface-500">{formatDateTime(r.createdAt)}</td>
                    <td>
                      <Badge variant={
                        r.status === 'PENDING' ? 'pending'
                          : r.status === 'APPROVED' ? 'active' : 'rejected'
                      }>
                        {r.status}
                      </Badge>
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td className="text-right">
                        {r.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => setApproveTarget(r)}
                            >
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => setRejectTarget(r)}
                            >
                              <XCircle size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve and post to blockchain?"
        message={approveTarget
          ? `Approve ${TYPE_LABELS[approveTarget.type]?.toLowerCase() || 'request'} of ${formatCurrency(approveTarget.amount)} for ${approveTarget.fullName || approveTarget.memberId}? This will write to the blockchain ledger.`
          : ''}
        confirmLabel="Approve"
        variant="primary"
        onConfirm={() => approveMutation.mutate(approveTarget.id)}
        loading={approveMutation.isPending}
      />

      <RejectModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        request={rejectTarget || {}}
      />
    </div>
  )
}
