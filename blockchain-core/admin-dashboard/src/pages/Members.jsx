// =============================================================================
// TrustLedger - Members Page
// List all members, view details, deposit, withdraw, suspend/activate
// =============================================================================

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Search, Plus, ArrowUpCircle, ArrowDownCircle,
  MoreVertical, UserCheck, UserX, Eye, RefreshCw
} from 'lucide-react'
import { membersApi, authApi } from '@/services/api'
import { formatDate, getApiError } from '@/utils/helpers'
import {
  Badge, Modal, Input, Select, Textarea, Spinner,
  Alert, EmptyState, TableSkeleton, ConfirmDialog
} from '@/components/ui'
import { useAuthStore } from '@/store/auth.store'

// ── Deposit / Withdraw Modal ──────────────────────────────────────────────────
function TransactionModal({ open, onClose, memberId, type }) {
  const qc = useQueryClient()
  const [apiError, setApiError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  const mutation = useMutation({
    mutationFn: (data) =>
      type === 'deposit'
        ? membersApi.deposit(memberId, data)
        : membersApi.withdraw(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      qc.invalidateQueries({ queryKey: ['member', memberId] })
      reset()
      onClose()
    },
    onError: (err) => setApiError(getApiError(err)),
  })

  const onSubmit = (data) => {
    setApiError(null)
    mutation.mutate({ ...data, amount: Number(data.amount) })
  }

  const isDeposit = type === 'deposit'

  return (
    <Modal open={open} onClose={onClose}
           title={isDeposit ? 'Record Deposit' : 'Record Withdrawal'} size="sm">
      {apiError && (
        <div className="mb-4">
          <Alert type="error" onClose={() => setApiError(null)}>{apiError}</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Amount (UGX)"
          type="number"
          min="1"
          placeholder="500000"
          error={errors.amount?.message}
          {...register('amount', {
            required: 'Amount is required',
            min: { value: 1, message: 'Amount must be positive' }
          })}
        />
        <Input
          label="Payment Reference"
          placeholder="e.g. MOMO-TXN-12345"
          error={errors.reference?.message}
          {...register('reference', { required: 'Reference is required' })}
        />
        {!isDeposit && (
          <Textarea
            label="Reason for withdrawal"
            placeholder="Member requested for school fees…"
            error={errors.reason?.message}
            {...register('reason', { required: 'Reason is required' })}
          />
        )}
        <Select
          label="Channel"
          options={[
            { value: 'TELLER', label: 'Teller (Branch)' },
            { value: 'MOBILE_APP', label: 'Mobile App' },
            { value: 'USSD', label: 'USSD' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
          ]}
          {...register('channel')}
        />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className={isDeposit ? 'btn-primary' : 'btn-danger'}
          >
            {(isSubmitting || mutation.isPending) && <Spinner size={14} />}
            {isDeposit ? 'Record Deposit' : 'Record Withdrawal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Register Member Modal ─────────────────────────────────────────────────────
function RegisterMemberModal({ open, onClose }) {
  const qc = useQueryClient()
  const [apiError, setApiError] = useState(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  const mutation = useMutation({
    mutationFn: (data) => authApi.register({ ...data, role: 'MEMBER' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      reset()
      onClose()
    },
    onError: (err) => setApiError(getApiError(err)),
  })

  const onSubmit = (data) => {
    setApiError(null)
    mutation.mutate(data)
  }

  return (
    <Modal open={open} onClose={onClose} title="Register New Member" size="md">
      {apiError && (
        <div className="mb-4">
          <Alert type="error" onClose={() => setApiError(null)}>{apiError}</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-xs text-surface-500 -mt-1 mb-2">
          Always creates a <strong>MEMBER</strong> login (SACCO savings account). Admin/Auditor staff are not created here.
        </p>
        <Input
          label="Member ID"
          placeholder="MEM001"
          error={errors.memberId?.message}
          {...register('memberId', { required: 'Member ID required' })}
        />
        <Input
          label="Full Name"
          placeholder="Alice Nakato"
          error={errors.fullName?.message}
          {...register('fullName', { required: 'Full name required' })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="alice@example.com"
            error={errors.email?.message}
            {...register('email', { required: 'Email required' })}
          />
          <Input
            label="Phone"
            placeholder="+256700123456"
            error={errors.phone?.message}
            {...register('phone', { required: 'Phone required' })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="National ID"
            placeholder="CM900123456"
            error={errors.nationalId?.message}
            {...register('nationalId', { required: 'National ID required' })}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password required',
              minLength: { value: 8, message: 'Min 8 characters' }
            })}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending && <Spinner size={14} />}
            Register Member
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Row Actions Dropdown ──────────────────────────────────────────────────────
function RowActions({ member, onDeposit, onWithdraw, onToggleStatus }) {
  const [open, setOpen] = useState(false)
  const isAdmin = useAuthStore(s => s.isAdmin())

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-surface-200 z-20 py-1 text-sm">
            <Link
              to={`/members/${member.memberId}`}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-50 text-surface-700"
              onClick={() => setOpen(false)}
            >
              <Eye size={14} /> View Profile
            </Link>
            {isAdmin && (
              <>
                <button onClick={() => { setOpen(false); onDeposit() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-surface-50 text-surface-700">
                  <ArrowUpCircle size={14} className="text-emerald-500" /> Deposit
                </button>
                <button onClick={() => { setOpen(false); onWithdraw() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-surface-50 text-surface-700">
                  <ArrowDownCircle size={14} className="text-red-400" /> Withdraw
                </button>
                <div className="border-t border-surface-100 my-1" />
                <button onClick={() => { setOpen(false); onToggleStatus() }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 hover:bg-surface-50
                    ${member.status === 'ACTIVE' ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {member.status === 'ACTIVE'
                    ? <><UserX size={14} /> Suspend</>
                    : <><UserCheck size={14} /> Reactivate</>
                  }
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Members Page ─────────────────────────────────────────────────────────
export default function MembersPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [txModal, setTxModal] = useState(null)   // { memberId, type }
  const [registerOpen, setRegisterOpen] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState(null)  // member object

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['members'],
    queryFn:  () => membersApi.getAll().then(r => r.data.data),
  })

  const members = Array.isArray(data) ? data : []

  const filtered = useMemo(() => {
    return members.filter(m => {
      const matchSearch = !search ||
        m.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        m.memberId?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.includes(search)
      const matchStatus = statusFilter === 'ALL' || m.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [members, search, statusFilter])

  const statusMutation = useMutation({
    mutationFn: ({ memberId, status, reason }) =>
      membersApi.updateStatus(memberId, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      setStatusConfirm(null)
    },
  })

  const handleToggleStatus = (member) => setStatusConfirm(member)

  const confirmStatusToggle = () => {
    const newStatus = statusConfirm.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const reason = newStatus === 'SUSPENDED'
      ? 'Suspended by admin'
      : 'Reactivated by admin'
    statusMutation.mutate({ memberId: statusConfirm.memberId, status: newStatus, reason })
  }

  const statusVariantMap = { ACTIVE: 'active', SUSPENDED: 'suspended', CLOSED: 'rejected' }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">
            {members.length} shown (ledger + registered accounts, excluding super admin).
            USSD resolves members by <span className="text-surface-600 font-medium">phone</span> — match the carrier format.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          {isAdmin && (
            <button onClick={() => setRegisterOpen(true)} className="btn-primary btn-sm">
              <Plus size={14} /> Register Member
            </button>
          )}
        </div>
      </div>

      {isError && (
        <Alert type="error">
          Could not load members: {getApiError(error)}. Is the API running on port 3000? If Fabric is disabled, the list should still load from the database — check server logs.
        </Alert>
      )}

      {!isAdmin && (
        <Alert type="info">
          You are signed in as <strong className="capitalize">{user?.role?.toLowerCase() || 'staff'}</strong>.
          <span className="block mt-1 text-surface-600">
            <strong>Register Member</strong>, <strong>Deposit</strong>, <strong>Withdraw</strong>, and <strong>Suspend</strong> are only available to{' '}
            <strong>Admin</strong> or <strong>Super Admin</strong> (same as the API). Sign out and log in with{' '}
            <code className="text-xs bg-surface-100 px-1 rounded">admin@trustledger.com</code> to manage members.
          </span>
        </Alert>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID or phone…"
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'SUSPENDED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-navy-950'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No members found"
            description={search ? 'Try a different search term.' : 'Register the first member to get started.'}
            action={isAdmin
              ? <button onClick={() => setRegisterOpen(true)} className="btn-primary btn-sm"><Plus size={14} />Register Member</button>
              : null
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Member ID</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Registered</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.memberId}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-navy-900 shrink-0 ring-2 ring-brand-400/30">
                        {member.fullName?.charAt(0)}
                      </div>
                      <span className="font-medium text-surface-800">{member.fullName}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs bg-surface-100 px-2 py-0.5 rounded">{member.memberId}</span></td>
                  <td className="text-surface-500">{member.phone}</td>
                  <td>
                    <span className="text-xs capitalize text-surface-500">{member.role}</span>
                  </td>
                  <td className="text-surface-400">{formatDate(member.registeredAt)}</td>
                  <td>
                    <Badge variant={statusVariantMap[member.status] || 'default'}>
                      {member.status}
                    </Badge>
                  </td>
                  <td>
                    <RowActions
                      member={member}
                      onDeposit={() => setTxModal({ memberId: member.memberId, type: 'deposit' })}
                      onWithdraw={() => setTxModal({ memberId: member.memberId, type: 'withdraw' })}
                      onToggleStatus={() => handleToggleStatus(member)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {txModal && (
        <TransactionModal
          open={!!txModal}
          onClose={() => setTxModal(null)}
          memberId={txModal.memberId}
          type={txModal.type}
        />
      )}
      <RegisterMemberModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <ConfirmDialog
        open={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        onConfirm={confirmStatusToggle}
        loading={statusMutation.isPending}
        title={statusConfirm?.status === 'ACTIVE' ? 'Suspend Member' : 'Reactivate Member'}
        message={`Are you sure you want to ${statusConfirm?.status === 'ACTIVE' ? 'suspend' : 'reactivate'} ${statusConfirm?.fullName}?`}
        confirmLabel={statusConfirm?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        variant={statusConfirm?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </div>
  )
}
