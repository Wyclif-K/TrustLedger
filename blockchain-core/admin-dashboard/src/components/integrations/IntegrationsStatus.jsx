// =============================================================================
// TrustLedger — system + USSD / channel integration status (from API health +
// optional USSD bridge health via Vite proxy).
// =============================================================================

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle, XCircle, AlertTriangle, Loader2, HelpCircle,
} from 'lucide-react'
import { fetchUssdBridgeHealth } from '@/services/api'

function Row({ label, children, hint }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800">{label}</p>
        {hint && (
          <p className="text-xs text-surface-400 mt-0.5">{hint}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5 text-sm">{children}</div>
    </div>
  )
}

function StateIcon({ kind }) {
  if (kind === 'loading') {
    return <Loader2 size={16} className="text-surface-400 animate-spin" />
  }
  if (kind === 'ok') {
    return <CheckCircle size={16} className="text-emerald-500" />
  }
  if (kind === 'warn') {
    return <AlertTriangle size={16} className="text-amber-500" />
  }
  if (kind === 'bad') {
    return <XCircle size={16} className="text-red-500" />
  }
  return <HelpCircle size={16} className="text-surface-300" />
}

export default function IntegrationsStatus({ health, healthLoading }) {
  const { data: bridge, isLoading: bridgeLoading, isError: bridgeError, error } = useQuery({
    queryKey: ['ussd-bridge-health'],
    queryFn:  fetchUssdBridgeHealth,
    retry:    1,
    refetchInterval: 30_000,
  })

  const at = health?.channels?.africaSTalking

  const fabricKind =
    healthLoading || !health ? 'loading'
      : health.fabric === 'up' ? 'ok'
        : health.fabric === 'disabled' ? 'warn'
          : 'warn'

  const ussdApiKind =
    healthLoading || !health ? 'loading'
      : health.ussdInternalApi === 'configured' ? 'ok'
        : 'bad'

  const atKind =
    healthLoading || !health ? 'loading'
      : health.africasTalking === 'configured' ? 'ok'
        : 'warn'

  const bridgeBackendOk = typeof bridge?.backend === 'string' && bridge.backend === 'connected'
  const bridgeKind =
    bridgeLoading ? 'loading'
      : bridgeError ? 'bad'
        : bridgeBackendOk ? 'ok'
          : 'warn'

  const bridgeHint = bridgeError
    ? (error?.message || 'Start ussd-service on port 4000 (npm run dev in ussd-bridge/ussd-service).')
    : null

  return (
    <div>
      <Row
        label="PostgreSQL"
        hint="Required for admin login and ledger APIs."
      >
        <StateIcon kind={healthLoading || !health ? 'loading' : health.database === 'up' ? 'ok' : 'bad'} />
        <span className={health?.database === 'up' ? 'text-emerald-700' : 'text-red-600'}>
          {healthLoading ? '…' : health?.database === 'up' ? 'Up' : 'Down'}
        </span>
      </Row>

      <Row
        label="Hyperledger Fabric"
        hint={health?.fabric === 'disabled' ? 'API runs in DB-only mode.' : 'Peer connectivity for on-chain writes.'}
      >
        <StateIcon kind={fabricKind} />
        <span className="text-surface-600">
          {healthLoading ? '…'
            : health?.fabric === 'disabled' ? 'Disabled'
              : health?.fabric === 'up' ? 'Connected'
                : 'Not connected'}
        </span>
      </Row>

      <Row
        label="Africa's Talking"
        hint={at?.shortCode ? `Service code ${at.shortCode} · ${at.environment}` : 'SMS / production USSD callbacks.'}
      >
        <StateIcon kind={atKind} />
        <span className="text-surface-600">
          {healthLoading ? '…'
            : health?.africasTalking === 'configured'
              ? (at?.username ? `${at.username} (${at.environment})` : 'Configured')
              : 'Not configured'}
        </span>
      </Row>

      <Row
        label="USSD internal API"
        hint="BACKEND_API_KEY on the bridge must match USSD_SERVICE_KEY here."
      >
        <StateIcon kind={ussdApiKind} />
        <span className={ussdApiKind === 'ok' ? 'text-emerald-700' : 'text-amber-800'}>
          {healthLoading ? '…' : health?.ussdInternalApi === 'configured' ? 'Key set' : 'Key missing'}
        </span>
      </Row>

      <Row
        label="USSD bridge service"
        hint={bridgeHint || 'Dev: Vite proxies /ussd-bridge → :4000. Production: configure the same in your reverse proxy.'}
      >
        <StateIcon kind={bridgeKind} />
        <span className="text-surface-600 text-right max-w-[200px] truncate" title={bridge?.backend}>
          {bridgeLoading ? 'Checking…'
            : bridgeError ? 'Unreachable'
              : (
                <>
                  {bridge?.redis?.status === 'redis' ? 'Redis' : 'Memory sessions'}
                  {' · '}
                  {bridgeBackendOk ? 'API linked' : (bridge?.backend || 'Unknown')}
                </>
              )}
        </span>
      </Row>
    </div>
  )
}
