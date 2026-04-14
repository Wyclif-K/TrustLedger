// =============================================================================
// TrustLedger - Dashboard Page
// =============================================================================

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, CreditCard, TrendingUp, AlertCircle,
         ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { reportsApi, loansApi, healthApi } from '@/services/api'
import { formatCurrency, formatDate, getApiError } from '@/utils/helpers'
import { StatCard, TableSkeleton, EmptyState, Alert } from '@/components/ui'
import IntegrationsStatus from '@/components/integrations/IntegrationsStatus'

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-navy-100 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-medium text-navy-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {formatCurrency(p.value, true)}
        </p>
      ))}
    </div>
  )
}

// ── Loan status pie colors ─────────────────────────────────────────────────────
const PIE_COLORS = {
  PENDING:   '#f59e0b',
  APPROVED:  '#0B1B32',
  DISBURSED: '#8b5cf6',
  REPAID:    '#10b981',
  REJECTED:  '#ef4444',
}

function ConnectionStatusPill({ health, isLoading }) {
  if (isLoading || !health) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-500 bg-surface-100 border border-surface-200 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-surface-400 animate-pulse" />
        Checking services…
      </div>
    );
  }
  if (health.database !== 'up') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Database unavailable
      </div>
    );
  }
  if (health.fabric === 'disabled') {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Fabric disabled (auth only)
      </div>
    );
  }
  if (health.fabric === 'up') {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
        Fabric connected
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Fabric peer not connected
    </div>
  );
}

export default function DashboardPage() {
  const { data: statsRes, isLoading: statsLoading, isError: statsError, error: statsErr } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => reportsApi.dashboard().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: trendsRes, isLoading: trendsLoading } = useQuery({
    queryKey: ['monthly-trends', 7],
    queryFn:  () => reportsApi.monthlyTrends({ months: 7 }).then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn:  healthApi.status,
    refetchInterval: 30_000,
  })

  const { data: pendingRes, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-loans'],
    queryFn:  () => loansApi.getAll({ status: 'PENDING' }).then(r => r.data.data),
  })

  const { data: txRes, isLoading: txLoading } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn:  () => reportsApi.transactions({ limit: 8 }).then(r => r.data.data),
  })

  const stats = statsRes || {}
  const pendingLoans = Array.isArray(pendingRes) ? pendingRes : []
  const recentTx = Array.isArray(txRes) ? txRes : []

  const loanPieData = stats.loans
    ? Object.entries({
        PENDING:   stats.loans.pending    || 0,
        DISBURSED: stats.loans.disbursed  || 0,
        REPAID:    stats.loans.repaid     || 0,
      }).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
    : []

  const chartSeries = Array.isArray(trendsRes?.series) ? trendsRes.series : []

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">TrustLedger SACCO — live blockchain overview</p>
        </div>
        <ConnectionStatusPill health={health} isLoading={healthLoading} />
      </div>

      {statsError && (
        <Alert type="error">
          Dashboard stats failed to load: {getApiError(statsErr)}. Member counts may stay at zero until the API responds.
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={statsLoading ? '—' : (stats.members?.total ?? 0)}
          sub={`${stats.members?.active ?? 0} active`}
          icon={Users}
          color="brand"
          className="animation-delay-100"
        />
        <StatCard
          label="Total Savings"
          value={statsLoading ? '—' : formatCurrency(stats.savings?.totalBalance, true)}
          sub={`${stats.savings?.accountCount ?? 0} accounts`}
          icon={TrendingUp}
          color="emerald"
          className="animation-delay-200"
        />
        <StatCard
          label="Active Loans"
          value={statsLoading ? '—' : (stats.loans?.disbursed ?? 0)}
          sub={formatCurrency(stats.loans?.totalOutstanding, true) + ' outstanding'}
          icon={CreditCard}
          color="violet"
          className="animation-delay-300"
        />
        <StatCard
          label="Pending Approvals"
          value={statsLoading ? '—' : (stats.loans?.pending ?? 0)}
          sub="Awaiting admin review"
          icon={AlertCircle}
          color="amber"
          className="animation-delay-400"
        />
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <div>
            <h2 className="text-sm font-semibold text-surface-800">System &amp; integrations</h2>
            <p className="text-xs text-surface-400 mt-0.5">Database, Fabric, Africa&apos;s Talking, USSD bridge</p>
          </div>
          <Link to="/integrations" className="text-xs text-brand-600 hover:underline shrink-0">
            Full guide &amp; test steps
          </Link>
        </div>
        <IntegrationsStatus health={health} healthLoading={healthLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Savings vs Loan Activity</h2>
            <span className="text-xs text-surface-400">From ledger (last 7 months)</span>
          </div>
          {trendsLoading ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-surface-400">Loading trends…</div>
          ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gDeposits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F6A609" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F6A609" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLoans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0B1B32" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="#0B1B32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                     tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#F6A609"
                    strokeWidth={2} fill="url(#gDeposits)" />
              <Area type="monotone" dataKey="loans" name="Loan activity" stroke="#0B1B32"
                    strokeWidth={2} fill="url(#gLoans)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">Loan Distribution</h2>
          {loanPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={loanPieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80}
                     paddingAngle={3} dataKey="value">
                  {loanPieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#e5e7eb'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, '']} />
                <Legend iconType="circle" iconSize={8}
                        formatter={v => <span className="text-xs text-surface-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-surface-400">
              No loan data yet
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
            <h2 className="text-sm font-semibold text-surface-800">Pending Approvals</h2>
            <Link to="/loans?status=PENDING" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {pendingLoading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : pendingLoans.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No pending loans" description="All loan applications have been reviewed." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Applied</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingLoans.slice(0, 5).map(loan => (
                  <tr key={loan.loanId}>
                    <td className="font-medium text-surface-800">{loan.memberId}</td>
                    <td className="font-mono text-sm">{formatCurrency(loan.amount, true)}</td>
                    <td className="text-surface-400">{formatDate(loan.appliedAt)}</td>
                    <td>
                      <Link to={`/loans/${loan.loanId}`}
                            className="text-xs text-brand-600 hover:underline">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
            <h2 className="text-sm font-semibold text-surface-800">Recent Transactions</h2>
            <Link to="/reports" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {txLoading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : recentTx.length === 0 ? (
            <EmptyState icon={CreditCard} title="No transactions yet" />
          ) : (
            <div className="divide-y divide-surface-100">
              {recentTx.map(tx => (
                <div key={tx.txId} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === 'DEPOSIT'    ? 'bg-emerald-50 text-emerald-600' :
                    tx.type === 'WITHDRAWAL' ? 'bg-red-50 text-red-500' :
                    'bg-violet-50 text-violet-600'
                  }`}>
                    {tx.type === 'DEPOSIT' ? <TrendingUp size={14} /> :
                     tx.type === 'WITHDRAWAL' ? <XCircle size={14} /> :
                     <CreditCard size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {tx.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-surface-400">{tx.memberId}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-medium ${tx.type === 'WITHDRAWAL' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {tx.type === 'WITHDRAWAL' ? '−' : '+'}{formatCurrency(tx.amount, true)}
                    </p>
                    <p className="text-xs text-surface-400">{formatDate(tx.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
