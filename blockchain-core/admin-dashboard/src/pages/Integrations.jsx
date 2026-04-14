// =============================================================================
// TrustLedger — Integrations & USSD stack (admin reference + live status)
// =============================================================================

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import IntegrationsStatus from '@/components/integrations/IntegrationsStatus'
import { healthApi } from '@/services/api'

export default function IntegrationsPage() {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn:  healthApi.status,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-4 transition-colors"
        >
          <ArrowLeft size={13} /> Back to Dashboard
        </Link>
        <div className="page-header">
          <div>
            <h1 className="page-title">Integrations</h1>
            <p className="page-subtitle">
              Backend, Fabric, Africa&apos;s Talking, and USSD bridge — what must be running for the full stack.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-800 mb-1">Live status</h2>
        <p className="text-xs text-surface-400 mb-4">
          API health is public; bridge status uses the dev proxy path <code className="text-[11px] bg-surface-100 px-1 rounded">/ussd-bridge/health</code>.
        </p>
        <IntegrationsStatus health={health} healthLoading={healthLoading} />
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-800">End-to-end USSD test</h2>
        <ol className="list-decimal list-inside text-sm text-surface-600 space-y-2">
          <li>
            Run the API (<code className="text-xs bg-surface-100 px-1 rounded">blockchain-core/backend</code>) and this dashboard.
          </li>
          <li>
            Run <code className="text-xs bg-surface-100 px-1 rounded">ussd-bridge/ussd-service</code> on port 4000 with{' '}
            <code className="text-xs bg-surface-100 px-1 rounded">BACKEND_API_URL</code> and{' '}
            <code className="text-xs bg-surface-100 px-1 rounded">BACKEND_API_KEY</code> equal to{' '}
            <code className="text-xs bg-surface-100 px-1 rounded">USSD_SERVICE_KEY</code> in the backend <code className="text-xs bg-surface-100 px-1 rounded">.env</code>.
          </li>
          <li>
            Confirm a <Link to="/members" className="text-brand-600 hover:underline">member</Link> exists whose{' '}
            <strong>phone</strong> matches what you send in the simulator (E.164, e.g. +256…).
          </li>
          <li>
            POST a sample payload to the bridge (PowerShell example):
            <pre className="mt-2 p-3 rounded-lg bg-surface-900 text-surface-100 text-xs overflow-x-auto font-mono leading-relaxed">
{`Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -ContentType "application/x-www-form-urlencoded" -Body @{
  sessionId   = "test-001"
  phoneNumber = "+256700123456"
  text        = ""
}`}
            </pre>
            Replace <code className="text-surface-300">phoneNumber</code> with a registered member phone. Expect a <code className="text-surface-300">CON</code> or <code className="text-surface-300">END</code> plain-text menu response.
          </li>
          <li>
            For carrier testing, point Africa&apos;s Talking USSD callback to your public HTTPS URL + <code className="text-xs bg-surface-100 px-1 rounded">/ussd</code> (e.g. via ngrok). See{' '}
            <a
              href="https://developers.africastalking.com/docs/ussd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              AT USSD docs <ExternalLink size={12} />
            </a>.
          </li>
        </ol>
      </div>
    </div>
  )
}
