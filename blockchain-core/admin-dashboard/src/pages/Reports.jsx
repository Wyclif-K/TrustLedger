// =============================================================================
// TrustLedger - Reports Page
// Date-range reports, transaction explorer, bar charts, print & CSV export
// =============================================================================

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Download, Search, TrendingUp, TrendingDown, Repeat, Printer } from 'lucide-react'
import { reportsApi } from '@/services/api'
import {
  formatCurrency,
  formatDateTime,
  formatDate,
  txTypeLabel,
  getApiError,
  downloadCsv,
} from '@/utils/helpers'
import { Badge, Alert, TableSkeleton, EmptyState, Spinner } from '@/components/ui'
import { format, subMonths } from 'date-fns'

const TX_TYPE_COLORS = {
  DEPOSIT: '#14b8a6', WITHDRAWAL: '#ef4444',
  LOAN_REPAY: '#8b5cf6', LOAN_DISBURSE: '#f59e0b',
}

const TX_VARIANTS = {
  DEPOSIT: 'active', WITHDRAWAL: 'rejected',
  LOAN_APPLY: 'pending', LOAN_APPROVE: 'approved',
  LOAN_DISBURSE: 'disbursed', LOAN_REPAY: 'repaid', LOAN_REJECT: 'rejected',
}

// ── Chart tooltip ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-surface-200 rounded-xl p-3 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold text-surface-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-mono font-medium">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Date range form ────────────────────────────────────────────────────────────
function DateRangeForm({ onSearch, loading }) {
  const defaultFrom = format(subMonths(new Date(), 1), 'yyyy-MM-dd')
  const defaultTo   = format(new Date(), 'yyyy-MM-dd')

  const { register, handleSubmit } = useForm({
    defaultValues: { from: defaultFrom, to: defaultTo, type: '' }
  })

  return (
    <form onSubmit={handleSubmit(onSearch)}
          className="card p-4 flex flex-col sm:flex-row gap-3 items-end print:hidden">
      <div className="flex-1 space-y-1">
        <label className="label">From date</label>
        <input type="date" className="input" {...register('from', { required: true })} />
      </div>
      <div className="flex-1 space-y-1">
        <label className="label">To date</label>
        <input type="date" className="input" {...register('to', { required: true })} />
      </div>
      <div className="flex-1 space-y-1">
        <label className="label">Transaction type</label>
        <select className="input" {...register('type')}>
          <option value="">All types</option>
          <option value="DEPOSIT">Deposits</option>
          <option value="WITHDRAWAL">Withdrawals</option>
          <option value="LOAN_REPAY">Loan Repayments</option>
          <option value="LOAN_DISBURSE">Disbursements</option>
        </select>
      </div>
      <button type="submit" disabled={loading} className="btn-primary shrink-0">
        {loading ? <Spinner size={14} /> : <Search size={14} />}
        Generate Report
      </button>
    </form>
  )
}

function exportTransactionsCsv(filename, txs) {
  if (!txs?.length) return
  downloadCsv(filename, [
    { key: 'txId', header: 'Transaction ID' },
    { key: 'type', header: 'Type' },
    { key: 'memberId', header: 'Member ID' },
    { key: 'amount', header: 'Amount (UGX)' },
    { key: 'channel', header: 'Channel', accessor: (r) => (r.channel || '').replace(/_/g, ' ') || '—' },
    { key: 'timestamp', header: 'Timestamp (ISO)' },
  ], txs.map((t) => ({
    ...t,
    amount: t.amount != null ? Number(t.amount) : '',
  })))
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [reportParams, setReportParams] = useState(null)
  const [searchTx, setSearchTx]         = useState('')

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['all-transactions'],
    queryFn:  () => reportsApi.transactions({ limit: 50 }).then(r => r.data.data),
  })

  const { data: rangeData, isLoading: rangeLoading, error: rangeError } = useQuery({
    queryKey: ['range-report', reportParams],
    queryFn:  () => reportsApi.range(reportParams).then(r => r.data.data),
    enabled:  !!reportParams,
  })

  const allTx = Array.isArray(txData) ? txData : []

  const filteredTx = searchTx
    ? allTx.filter(t =>
        t.memberId?.toLowerCase().includes(searchTx.toLowerCase()) ||
        t.txId?.toLowerCase().includes(searchTx.toLowerCase()) ||
        t.type?.toLowerCase().includes(searchTx.toLowerCase())
      )
    : allTx

  const chartData = rangeData?.totals
    ? Object.entries(rangeData.totals).map(([type, amount]) => ({
        name: txTypeLabel(type),
        amount,
        fill: TX_TYPE_COLORS[type] || '#94a3b8',
      }))
    : []

  const depositTotal    = rangeData?.totals?.DEPOSIT    || 0
  const withdrawalTotal = rangeData?.totals?.WITHDRAWAL || 0
  const repayTotal      = rangeData?.totals?.LOAN_REPAY || 0

  const handlePrint = () => window.print()

  const exportRangeCsv = () => {
    if (!rangeData?.transactions?.length || !reportParams) return
    const typePart = reportParams.type ? `-${reportParams.type}` : ''
    exportTransactionsCsv(
      `trustledger-report-${reportParams.from}-${reportParams.to}${typePart}.csv`,
      rangeData.transactions
    )
  }

  const exportRecentCsv = () => {
    if (!filteredTx.length) return
    exportTransactionsCsv(
      `trustledger-recent-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`,
      filteredTx
    )
  }

  const rangeRows = rangeData?.transactions || []
  const rangeTableRows = rangeRows.slice(0, 50)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Visible only when printing */}
      <div className="hidden print:block border-b border-navy-200 pb-4 mb-4">
        <p className="font-display text-xl text-navy-900">TrustLedger — Reports</p>
        {rangeData ? (
          <p className="text-sm text-navy-700 mt-1">
            Period: {formatDate(rangeData.fromDate)} – {formatDate(rangeData.toDate)}
            {reportParams?.type ? ` · Type: ${txTypeLabel(reportParams.type)}` : ''}
            {' · '}{rangeData.transactionCount} transaction(s)
          </p>
        ) : (
          <p className="text-sm text-navy-700 mt-1">Recent transactions (last 50 from ledger)</p>
        )}
        <p className="text-xs text-navy-500 mt-2">
          Generated {formatDateTime(new Date().toISOString())}
        </p>
        <p className="text-[10px] text-navy-400 mt-3">
          On-screen tables list up to 50 rows per section. Use Export CSV for the full date-range extract.
        </p>
      </div>

      <div className="page-header print:hidden">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Financial analysis and transaction history</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" onClick={handlePrint} className="btn-secondary">
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <DateRangeForm onSearch={setReportParams} loading={rangeLoading} />

      {rangeError && (
        <Alert type="error">{getApiError(rangeError)}</Alert>
      )}

      {rangeData && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 print:hidden">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Total Deposits</p>
                <p className="font-mono font-semibold text-emerald-700">{formatCurrency(depositTotal, true)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500 print:hidden">
                <TrendingDown size={16} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Total Withdrawals</p>
                <p className="font-mono font-semibold text-red-600">{formatCurrency(withdrawalTotal, true)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 print:hidden">
                <Repeat size={16} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Loan Repayments</p>
                <p className="font-mono font-semibold text-violet-700">{formatCurrency(repayTotal, true)}</p>
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card p-5 print:hidden">
              <h3 className="text-sm font-semibold text-surface-800 mb-4">
                Transaction Totals — {rangeData.transactionCount} records
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                         tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="amount" name="Amount" radius={[6,6,0,0]}>
                    {chartData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="table-container">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-surface-100">
              <h3 className="text-sm font-semibold text-surface-800">
                Transactions in range ({rangeData.transactionCount})
              </h3>
              <button
                type="button"
                disabled={!rangeRows.length}
                onClick={exportRangeCsv}
                className="btn-secondary btn-sm print:hidden disabled:opacity-40"
              >
                <Download size={14} /> Export CSV (full range)
              </button>
            </div>
            {rangeRows.length === 0 ? (
              <EmptyState title="No transactions in this period" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tx ID</th>
                    <th>Type</th>
                    <th>Member</th>
                    <th>Amount</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeTableRows.map(tx => (
                    <tr key={tx.txId}>
                      <td><span className="font-mono text-xs text-surface-600">{tx.txId}</span></td>
                      <td>
                        <Badge variant={TX_VARIANTS[tx.type] || 'default'}>
                          {txTypeLabel(tx.type)}
                        </Badge>
                      </td>
                      <td className="font-medium text-surface-800">{tx.memberId}</td>
                      <td>
                        <span className={`font-mono text-sm ${
                          tx.type === 'WITHDRAWAL' ? 'text-red-500' : 'text-emerald-600'
                        }`}>
                          {formatCurrency(tx.amount, true)}
                        </span>
                      </td>
                      <td className="text-surface-400 text-xs">{formatDateTime(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {rangeRows.length > 50 && (
              <p className="px-5 py-2 text-xs text-surface-500 border-t border-surface-100 print:hidden">
                Showing first 50 of {rangeRows.length} rows. Export CSV for all rows.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="table-container">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-surface-800">Recent Transactions (last 50)</h3>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              disabled={!filteredTx.length}
              onClick={exportRecentCsv}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              <Download size={14} /> Export CSV
            </button>
            <div className="relative w-56">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input value={searchTx} onChange={e => setSearchTx(e.target.value)}
                placeholder="Search…" className="input pl-8 py-1.5 text-xs" />
            </div>
          </div>
        </div>
        {txLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filteredTx.length === 0 ? (
          <EmptyState title="No transactions found" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Tx ID</th><th>Type</th><th>Member</th><th>Amount</th><th>Channel</th><th>Timestamp</th></tr>
            </thead>
            <tbody>
              {filteredTx.map(tx => (
                <tr key={tx.txId}>
                  <td><span className="font-mono text-xs text-surface-600">{tx.txId}</span></td>
                  <td>
                    <Badge variant={TX_VARIANTS[tx.type] || 'default'}>{txTypeLabel(tx.type)}</Badge>
                  </td>
                  <td className="font-medium text-surface-800">{tx.memberId}</td>
                  <td>
                    <span className={`font-mono text-sm font-medium ${
                      tx.type === 'WITHDRAWAL' ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {tx.type === 'WITHDRAWAL' ? '−' : '+'}{formatCurrency(tx.amount, true)}
                    </span>
                  </td>
                  <td className="text-surface-400 text-xs capitalize">{(tx.channel || '—').replace(/_/g, ' ')}</td>
                  <td className="text-surface-400 text-xs">{formatDateTime(tx.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
