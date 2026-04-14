# Upgrade TrustLedger chaincode after changing chaincode sources (increments lifecycle sequence).
# Usage: npm run fabric:upgrade   (from backend folder)

$ErrorActionPreference = 'Stop'

$ScriptsDir = $PSScriptRoot
. (Join-Path $ScriptsDir 'fabric-cli-exec.ps1')

$ChaincodeDir = (Resolve-Path (Join-Path $ScriptsDir '..\..\chaincode')).Path

Write-Host 'Pulling fabric-nodeenv (Node chaincode build)...' -ForegroundColor Cyan
docker pull hyperledger/fabric-nodeenv:2.5 | Out-Null

Write-Host 'Installing chaincode npm dependencies...' -ForegroundColor Cyan
Push-Location $ChaincodeDir
npm install --omit=dev
Pop-Location

$Inner = Join-Path $ScriptsDir 'fabric-upgrade-inner.sh'
if (-not (Test-Path $Inner)) { Write-Error "Missing $Inner" }

$code = Invoke-FabricCliScript -LocalScriptPath $Inner -Message 'Upgrading chaincode on channel (new sequence)...'
if ($code -ne 0) { exit $code }
Write-Host 'Upgrade complete. Retry the operation in the app.' -ForegroundColor Green
