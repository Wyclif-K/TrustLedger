// =============================================================================
// TrustLedger - Member Detail Page
// Full profile: balance card, transaction history, loans, audit trail
// =============================================================================

import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, TrendingUp, CreditCard,
  ArrowUpCircle, ArrowDownCircle, AlertCircle
} from 'lucide-react'
import { membersApi } from '@/services/api'
import {
  formatCurrency, formatDateTime, formatDate,
  txTypeLabel
} from '@/utils/helpers'
import { Badge, TableSkeleton, EmptyState } from '@/components/ui'

function displayOrDash(value) {
  if (value === null || value === undefined || value === '') return '—'
  return value
}

// ── Balance Card ──────────────────────────────────────────────────────────────
function BalanceCard({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['member-balance', memberId],
    queryFn:  () => membersApi.getBalance(memberId).then(r => r.data.data),
  })

  if (isLoading) return <div className="card p-6 animate-pulse h-32 bg-surface-100 rounded-xl" />

  return (
    <div className="card bg-gradient-to-br from-navy-900 via-navy-900 to-navy-950 text-white p-6 border-0 shadow-lg ring-1 ring-navy-800">
      <p className="text-brand-400 text-xs font-medium uppercase tracking-wider mb-1">Savings Balance</p>
      <p className="text-3xl font-mono font-semibold mb-4 text-white">
        {formatCurrency(data?.balance)}
      </p>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-navy-600">
        <div>
          <p className="text-brand-200/80 text-xs">Total Deposited</p>
          <p className="text-sm font-mono font-medium mt-0.5">{formatCurrency(data?.totalDeposited, true)}</p>
        </div>
        <div>
          <p className="text-brand-200/80 text-xs">Total Withdrawn</p>
          <p className="text-sm font-mono font-medium mt-0.5">{formatCurrency(data?.totalWithdrawn, true)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Transaction History ───────────────────────────────────────────────────────
function TransactionHistory({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['member-transactions', memberId],
    queryFn:  () => membersApi.getTransactions(memberId).then(r => r.data.data),
  })

  const txs = Array.isArray(data) ? data : []

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-surface-100">
        <h3 className="text-sm font-semibold text-surface-800">Transaction History</h3>
        <p className="text-xs text-surface-400 mt-0.5">
          {txs.length} transaction{txs.length === 1 ? '' : 's'} on the blockchain
        </p>
      </div>
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : txs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No transactions yet" />
      ) : (
        <div className="divide-y divide-surface-100 max-h-96 overflow-y-auto">
          {txs.map((tx) => {
            const isCredit = ['DEPOSIT', 'LOAN_DISBURSE'].includes(tx.type)
            return (
              <div key={tx.txId} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-50">
                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {isCredit ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800">{txTypeLabel(tx.type)}</p>
                  <p className="text-xs text-surface-400 font-mono mt-0.5 truncate">{tx.txId}</p>
                  {tx.reference && (
                    <p className="text-xs text-surface-300 mt-0.5">Ref: {tx.reference}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-mono font-medium ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isCredit ? '+' : '−'}{formatCurrency(tx.amount, true)}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">{formatDateTime(tx.timestamp)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Member Loans ──────────────────────────────────────────────────────────────
function MemberLoans({ memberId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['member-loans', memberId],
    queryFn:  () => membersApi.getLoans(memberId).then(r => r.data.data),
  })

  const loans = Array.isArray(data) ? data : []
  const statusVariants = {
    PENDING: 'pending', APPROVED: 'approved', DISBURSED: 'disbursed',
    REPAID: 'repaid', REJECTED: 'rejected'
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-surface-100">
        <h3 className="text-sm font-semibold text-surface-800">Loan History</h3>
      </div>
      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : loans.length === 0 ? (
        <EmptyState icon={CreditCard} title="No loans" description="This member has not applied for any loans." />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Amount</th>
              <th>Term</th>
              <th>Outstanding</th>
              <th>Applied</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map(loan => (
              <tr key={loan.loanId}>
                <td><span className="font-mono text-xs">{loan.loanId?.slice(-12)}</span></td>
                <td className="font-mono text-sm">{formatCurrency(loan.amount, true)}</td>
                <td className="text-surface-500">{loan.termMonths}mo</td>
                <td className="font-mono text-sm text-violet-600">
                  {formatCurrency(loan.outstandingBalance, true)}
                </td>
                <td className="text-surface-400">{formatDate(loan.appliedAt)}</td>
                <td>
                  <Badge variant={statusVariants[loan.status] || 'default'}>{loan.status}</Badge>
                </td>
                <td>
                  <Link to={`/loans/${loan.loanId}`}
                        className="text-xs text-brand-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main Member Detail Page ───────────────────────────────────────────────────
export default function MemberDetailPage() {
  const { memberId } = useParams()

  const { data: memberData, isLoading, isError, error } = useQuery({
    queryKey: ['member', memberId],
    queryFn:  () => membersApi.getOne(memberId).then(r => r.data.data),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    const status = error?.response?.status
    const notFound = status === 404
    const forbidden = status === 403
    return (
      <div className="space-y-4 animate-fade-in">
        <Link to="/members" className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 transition-colors">
          <ArrowLeft size={13} /> Back to Members
        </Link>
        <EmptyState
          icon={AlertCircle}
          title={
            notFound ? 'Member not found'
              : forbidden ? 'Access denied'
                : 'Could not load member'
          }
          description={
            notFound
              ? 'There is no member with this ID on the ledger.'
              : forbidden
                ? 'You can only open your own member profile unless you are an admin. Sign in with an admin account to view any member.'
                : (error?.response?.data?.message || 'Try again or check your connection.')
          }
        />
      </div>
    )
  }

  const member = memberData || {}
  const statusVariants = { ACTIVE: 'active', SUSPENDED: 'suspended', CLOSED: 'rejected' }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + Header */}
      <div>
        <Link to="/members" className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-4 transition-colors">
          <ArrowLeft size={13} /> Back to Members
        </Link>
        <div className="page-header">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-xl font-semibold text-navy-900 ring-2 ring-brand-400/35">
              {member.fullName?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl text-surface-900">{member.fullName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded">
                  {member.memberId}
                </span>
                <Badge variant={statusVariants[member.status] || 'default'}>{member.status}</Badge>
                <span className="text-xs text-surface-400 capitalize">{member.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top row: balance + member info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BalanceCard memberId={memberId} />
        </div>
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Member Information</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Email', displayOrDash(member.email)],
              ['Phone', displayOrDash(member.phone)],
              ['National ID', displayOrDash(member.nationalId)],
              ['Last sign-in', formatDateTime(member.lastLoginAt)],
              ['Registered', formatDate(member.registeredAt)],
              ['Last Updated', formatDate(member.updatedAt)],
              ['Registered By', displayOrDash(member.registeredByDisplay || member.registeredBy)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-surface-400 mb-0.5">{label}</p>
                <p className="text-surface-800 font-medium">{value}</p>
                {label === 'Phone' && member.phone && (
                  <p className="text-[11px] text-surface-400 mt-1 leading-snug">
                    USSD menus look up this member by this number (normalized formats supported).
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <TransactionHistory memberId={memberId} />

      {/* Loans */}
      <MemberLoans memberId={memberId} />
    </div>
  )
}
