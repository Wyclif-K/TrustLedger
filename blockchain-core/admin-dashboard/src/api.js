import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'

const api = axios.create({ baseURL: '/api/v1', headers: { 'Content-Type': 'application/json' }, withCredentials: true })

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
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken); processQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`; return api(original)
    } catch (err) { processQueue(err, null); useAuthStore.getState().logout(); return Promise.reject(err) }
    finally { refreshing = false }
  }
  return Promise.reject(error)
})

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
  transactions: (params) => api.get('/reports/transactions', { params }),
  range: (params) => api.get('/reports/range', { params }),
  pendingLoans: () => api.get('/reports/pending-loans'),
  getTransaction: (txId) => api.get(`/reports/transactions/${txId}`),
}
export default api
