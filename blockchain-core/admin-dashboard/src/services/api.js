import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'

/** Same-origin default (Docker/Railway bundle). Optional split deploy: set VITE_API_BASE_URL=https://your-api.up.railway.app */
const apiOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const baseURL = apiOrigin ? `${apiOrigin}/api/v1` : '/api/v1'
const refreshUrl = apiOrigin ? `${apiOrigin}/api/v1/auth/refresh` : '/api/v1/auth/refresh'

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' }, withCredentials: true })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = false, queue = []
const processQueue = (err, token = null) => { queue.forEach(p => err ? p.reject(err) : p.resolve(token)); queue = [] }

api.interceptors.response.use(res => res, async (error) => {
  const original = error.config
  if (error.response?.status === 401 && !original._retry) {
    if (refreshing) return new Promise((resolve, reject) => { queue.push({ resolve, reject }) })
      .then(token => { original.headers.Authorization = `Bearer ${token}`; return api(original) })
    original._retry = true; refreshing = true
    try {
      const { data } = await axios.post(refreshUrl, {}, { withCredentials: true })
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken); processQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`; return api(original)
    } catch (err) { processQueue(err, null); useAuthStore.getState().logout(); return Promise.reject(err) }
    finally { refreshing = false }
  }
  return Promise.reject(error)
})

export const healthApi = {
  /** Public; tolerates 503 body when the API process is up but the database is not. */
  status: () =>
    api
      .get('/health')
      .then((r) => r.data)
      .catch((err) => {
        if (err.response?.data) return err.response.data;
        throw err;
      }),
}

/**
 * USSD bridge GET /health (Vite dev proxies /ussd-bridge → localhost:4000).
 * Fails if the bridge is not running or proxy is not configured.
 */
export async function fetchUssdBridgeHealth() {
  const res = await fetch('/ussd-bridge/health', { credentials: 'omit' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const notificationsApi = {
  unreadCount: (params) => api.get('/notifications/unread-count', { params }),
  list: (params) => api.get('/notifications', { params }),
  markRead: (id, params) => api.patch(`/notifications/${id}/read`, null, { params }),
  markAllRead: (params) => api.patch('/notifications/read-all', null, { params }),
}

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  changePassword: (data) => api.put('/auth/password', data),
}
export const membersApi = {
  getAll: () => api.get('/members'),
  getOne: (id) => api.get(`/members/${id}`),
  getBalance: (id) => api.get(`/members/${id}/balance`),
  getTransactions: (id) => api.get(`/members/${id}/transactions`),
  getHistory: (id) => api.get(`/members/${id}/savings-history`),
  getLoans: (id) => api.get(`/members/${id}/loans`),
  verifyBalance: (id) => api.get(`/members/${id}/verify-balance`),
  deposit: (id, data) => api.post(`/members/${id}/deposit`, data),
  withdraw: (id, data) => api.post(`/members/${id}/withdraw`, data),
  updateStatus: (id, data) => api.patch(`/members/${id}/status`, data),
}
export const loansApi = {
  getPolicy: () => api.get('/loans/policy'),
  getAll: (params) => api.get('/loans', { params }),
  getOne: (id) => api.get(`/loans/${id}`),
  getRepayments: (id) => api.get(`/loans/${id}/repayments`),
  getHistory: (id) => api.get(`/loans/${id}/history`),
  apply: (data) => api.post('/loans', data),
  approve: (id, data) => api.post(`/loans/${id}/approve`, data),
  reject: (id, data) => api.post(`/loans/${id}/reject`, data),
  disburse: (id, data) => api.post(`/loans/${id}/disburse`, data),
  repay: (id, data) => api.post(`/loans/${id}/repay`, data),
}
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  monthlyTrends: (params) => api.get('/reports/monthly-trends', { params }),
  transactions: (params) => api.get('/reports/transactions', { params }),
  range: (params) => api.get('/reports/range', { params }),
  pendingLoans: () => api.get('/reports/pending-loans'),
  getTransaction: (txId) => api.get(`/reports/transactions/${txId}`),
}
export default api
