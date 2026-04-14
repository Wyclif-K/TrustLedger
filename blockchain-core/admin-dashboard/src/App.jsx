// =============================================================================
// TrustLedger - App Router
// =============================================================================

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

import AppLayout     from '@/components/layout/AppLayout'
import LoginPage     from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import MembersPage   from '@/pages/Members'
import MemberDetail  from '@/pages/MemberDetail'
import LoansPage     from '@/pages/Loans'
import ReportsPage   from '@/pages/Reports'
import AuditPage       from '@/pages/Audit'
import IntegrationsPage from '@/pages/Integrations'

// ── Protected route wrapper ────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// ── Public route wrapper (redirect if logged in) ──────────────────────────────
function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

        {/* Protected app */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<DashboardPage />} />
          <Route path="members"            element={<MembersPage />} />
          <Route path="members/:memberId"  element={<MemberDetail />} />
          <Route path="loans"              element={<LoansPage />} />
          <Route path="reports"            element={<ReportsPage />} />
          <Route path="audit"              element={<AuditPage />} />
          <Route path="integrations"       element={<IntegrationsPage />} />
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
