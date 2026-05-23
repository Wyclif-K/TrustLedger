// =============================================================================
// TrustLedger - Savings Page
// SACCO-wide balances, member accounts, deposits & withdrawals
// =============================================================================

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search, RefreshCw, PiggyBank, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, Users, Wallet,
} from 'lucide-react'
import { savingsApi } from '@/services/api'
import {
  formatCurrency, formatDateTime, txTypeLabel, getApiError,
} from '@/utils/helpers'
import {
  StatCard, Badge, Alert, EmptyState, TableSkeleton,
} from '@/components/ui'

const TX_VARIANTS = {
  DEPOSIT: 'active',
  WITHDRAWAL: 'rejected',
}

export default function SavingsPage() {
  const [tab, setTab] = useState('transactions')
  const [search, setSearch] = useState('')
  const [txFilter, setTxFilter] = useState('ALL')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['savings-overview'],
    queryFn: () => savingsApi.overview().then((r) => r.data.data),
    refetchInterval: 60_000,
  })

  const stats = data?.stats || {}
  const accounts = Array.isArray(data?.accounts) ? data.accounts : []
  const transactions = Array.isArray(data?.transactions) ? data.transactions : []

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts
    const q = search.toLowerCase()
    return accounts.filter(
      (a) =>
        a.memberId?.toLowerCase().includes(q) ||
        a.fullName?.toLowerCase().includes(q)
    )
  }, [accounts, search])

  const filteredTx = useMemo(() => {
    let list = transactions
    if (txFilter !== 'ALL') list = list.filter((t) => t.type === txFilter)
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (t) =>
        t.memberId?.toLowerCase().includes(q) ||
        t.memberName?.toLowerCase().includes(q) ||
        t.txId?.toLowerCase().includes(q) ||
        t.reference?.toLowerCase().includes(q)
    )
  }, [transactions, search, txFilter])

  const depositCount = transactions.filter((t) => t.type === 'DEPOSIT').length
  const withdrawalCount = transactions.filter((t) => t.type === 'WITHDRAWAL').length

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings</h1>
          <p className="page-subtitle">
            Member balances and deposit / withdrawal activity from the blockchain ledger
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {isError && (
        <Alert type="error">
          Could not load savings: {getApiError(error)}. Ensure the API and Fabric peer are running.
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Savings"
          value={isLoading ? '—' : formatCurrency(stats.totalBalance, true)}
          sub={`${stats.accountCount ?? 0} accounts on ledger`}
          icon={PiggyBank}
          color="emerald"
        />
        <StatCard
          label="Average Balance"
          value={isLoading ? '—' : formatCurrency(stats.averageBalance, true)}
          sub="Per savings account"
          icon={Wallet}
          color="brand"
        />
        <StatCard
          label="Recent Deposits"
          value={isLoading ? '—' : depositCount}
          sub="In latest 100 ledger txs"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          label="Recent Withdrawals"
          value={isLoading ? '—' : withdrawalCount}
          sub="In latest 100 ledger txs"
          icon={TrendingDown}
          color="red"
        />
      </div>

      <div className="card p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, ID, or transaction…"
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'transactions', label: 'Transactions' },
            { id: 'accounts', label: 'Member balances' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === id
                  ? 'bg-brand-600 text-navy-950'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'accounts' && (
        <div className="table-container">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredAccounts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No savings accounts"
              description={
                search
                  ? 'No accounts match your search.'
                  : 'Savings accounts are created when members are registered on the ledger.'
              }
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member ID</th>
                  <th>Balance</th>
                  <th>Total deposited</th>
                  <th>Total withdrawn</th>
                  <th>Tx count</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((row) => (
                  <tr key={row.memberId}>
                    <td className="font-medium text-surface-800">
                      {row.fullName || '—'}
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-surface-100 px-2 py-0.5 rounded">
                        {row.memberId}
                      </span>
                    </td>
                    <td className="font-mono text-sm font-semibold text-emerald-700">
                      {formatCurrency(row.balance)}
                    </td>
                    <td className="font-mono text-sm text-surface-600">
                      {formatCurrency(row.totalDeposited, true)}
                    </td>
                    <td className="font-mono text-sm text-surface-600">
                      {formatCurrency(row.totalWithdrawn, true)}
                    </td>
                    <td className="text-surface-500 text-sm">{row.transactionCount}</td>
                    <td>
                      <Link
                        to={`/members/${row.memberId}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        View profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'DEPOSIT', label: 'Deposits' },
              { id: 'WITHDRAWAL', label: 'Withdrawals' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTxFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  txFilter === id
                    ? 'bg-brand-600 text-navy-950'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="table-container">
            {isLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : filteredTx.length === 0 ? (
              <EmptyState
                icon={txFilter === 'WITHDRAWAL' ? ArrowDownCircle : ArrowUpCircle}
                title="No savings transactions"
                description={
                  search || txFilter !== 'ALL'
                    ? 'Try clearing filters or record a deposit from Members.'
                    : 'Deposits and withdrawals appear here once recorded on the ledger.'
                }
                action={
                  !search && txFilter === 'ALL' ? (
                    <Link to="/members" className="btn-primary btn-sm">
                      Go to Members
                    </Link>
                  ) : null
                }
              />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Member</th>
                    <th>Amount</th>
                    <th>Balance after</th>
                    <th>Channel</th>
                    <th>Reference</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => {
                    const isDeposit = tx.type === 'DEPOSIT'
                    return (
                      <tr key={tx.txId}>
                        <td>
                          <Badge variant={TX_VARIANTS[tx.type] || 'default'}>
                            {txTypeLabel(tx.type)}
                          </Badge>
                        </td>
                        <td>
                          <Link
                            to={`/members/${tx.memberId}`}
                            className="block font-medium text-surface-800 hover:text-brand-700"
                          >
                            {tx.memberName || tx.memberId}
                          </Link>
                          <span className="font-mono text-[11px] text-surface-400">
                            {tx.memberId}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`font-mono text-sm font-medium ${
                              isDeposit ? 'text-emerald-600' : 'text-red-500'
                            }`}
                          >
                            {isDeposit ? '+' : '−'}
                            {formatCurrency(tx.amount, true)}
                          </span>
                        </td>
                        <td className="font-mono text-sm text-surface-600">
                          {tx.balanceAfter != null
                            ? formatCurrency(tx.balanceAfter, true)
                            : '—'}
                        </td>
                        <td className="text-xs text-surface-500 capitalize">
                          {(tx.channel || '—').replace(/_/g, ' ')}
                        </td>
                        <td className="text-xs text-surface-500 max-w-[140px] truncate">
                          {tx.reference || '—'}
                        </td>
                        <td className="text-xs text-surface-400 whitespace-nowrap">
                          {formatDateTime(tx.timestamp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {transactions.length > 0 && (
              <p className="px-5 py-2 text-xs text-surface-500 border-t border-surface-100">
                Showing savings-related rows from the latest 100 ledger transactions.
                For full history by date, use{' '}
                <Link to="/reports" className="text-brand-600 hover:underline">Reports</Link>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
