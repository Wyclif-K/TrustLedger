# Regenerate genesis.block + channel tx from the CURRENT crypto-config (configtx.yaml MSPDir).
# Run after cryptogen whenever you see: access denied ... creator org [SaccoOrgMSP]
# Requires: configtxgen on PATH (Hyperledger Fabric binaries).
# Then: npm run fabric:down:volumes && npm run fabric:up && npm run fabric:deploy

$ErrorActionPreference = 'Stop'

$NetworkDir = (Resolve-Path (Join-Path $PSScriptRoot '..\network')).Path
$Artifacts = Join-Path $NetworkDir 'channel-artifacts'
$CryptoRel = Join-Path $NetworkDir 'crypto-config\peerOrganizations\sacco.trustledger.com\msp\cacerts'

if (-not (Test-Path $CryptoRel)) {
  Write-Error "Missing Sacco org MSP (expected under $CryptoRel). Run cryptogen first."
}

if (-not (Get-Command configtxgen -ErrorAction SilentlyContinue)) {
  $Bundled = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'bin\configtxgen.exe'
  if (Test-Path $Bundled) {
    $env:PATH = "$(Split-Path $Bundled -Parent);$env:PATH"
  }
}
if (-not (Get-Command configtxgen -ErrorAction SilentlyContinue)) {
  Write-Error 'configtxgen not found. Add Hyperledger Fabric binaries to PATH, or place configtxgen.exe under blockchain-core\bin.'
}

New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
$env:FABRIC_CFG_PATH = $NetworkDir
$CHANNEL_NAME = 'trustledger-channel'

Write-Host "FABRIC_CFG_PATH=$NetworkDir" -ForegroundColor Cyan
Write-Host 'Regenerating channel-artifacts with configtxgen...' -ForegroundColor Cyan

Push-Location $NetworkDir
try {
  & configtxgen -profile TrustLedgerGenesis `
    -channelID system-channel `
    -outputBlock (Join-Path $Artifacts 'genesis.block')

  & configtxgen -profile TrustLedgerChannel `
    -outputCreateChannelTx (Join-Path $Artifacts 'trustledger-channel.tx') `
    -channelID $CHANNEL_NAME

  & configtxgen -profile TrustLedgerChannel `
    -outputAnchorPeersUpdate (Join-Path $Artifacts 'SaccoOrgMSPanchors.tx') `
    -channelID $CHANNEL_NAME `
    -asOrg SaccoOrgMSP
}
finally {
  Pop-Location
}

Write-Host 'OK: genesis.block, trustledger-channel.tx, SaccoOrgMSPanchors.tx' -ForegroundColor Green
Write-Host 'Next: npm run fabric:down:volumes  (required if genesis changed), then fabric:up && fabric:deploy' -ForegroundColor Yellow
