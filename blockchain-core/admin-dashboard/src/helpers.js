import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const formatCurrency = (amount, compact = false) => {
  if (amount === null || amount === undefined) return '—'
  const n = Number(amount)
  if (compact && n >= 1_000_000) return `UGX ${(n/1_000_000).toFixed(1)}M`
  if (compact && n >= 1_000) return `UGX ${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
export const formatDate = (iso) => { if (!iso) return '—'; try { return format(parseISO(iso), 'dd MMM yyyy') } catch { return '—' } }
export const formatDateTime = (iso) => { if (!iso) return '—'; try { return format(parseISO(iso), 'dd MMM yyyy, HH:mm') } catch { return '—' } }
export const timeAgo = (iso) => { if (!iso) return '—'; try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }) } catch { return '—' } }
export const loanStatusClass = (s) => ({ PENDING:'badge-pending',APPROVED:'badge-approved',REJECTED:'badge-rejected',DISBURSED:'badge-disbursed',REPAID:'badge-repaid' }[s]||'badge-pending')
export const memberStatusClass = (s) => ({ ACTIVE:'badge-active',SUSPENDED:'badge-suspended',CLOSED:'badge-rejected' }[s]||'badge-pending')
export const txTypeLabel = (t) => ({ DEPOSIT:'Deposit',WITHDRAWAL:'Withdrawal',LOAN_APPLY:'Loan Apply',LOAN_APPROVE:'Loan Approved',LOAN_REJECT:'Loan Rejected',LOAN_DISBURSE:'Disbursement',LOAN_REPAY:'Repayment' }[t]||t)
export const getApiError = (err) => err?.response?.data?.message || err?.message || 'An unexpected error occurred.'
