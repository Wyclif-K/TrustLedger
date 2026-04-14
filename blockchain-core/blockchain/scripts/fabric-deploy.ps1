# TrustLedger — deploy channel + chaincode after `npm run fabric:up`
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File blockchain/scripts/fabric-deploy.ps1
# Or from backend:    npm run fabric:deploy

$ErrorActionPreference = 'Stop'

$ScriptsDir = $PSScriptRoot
. (Join-Path $ScriptsDir 'fabric-cli-exec.ps1')

$ChaincodeDir = (Resolve-Path (Join-Path $ScriptsDir '..\..\chaincode')).Path

Write-Host 'Pulling Fabric Node chaincode builder image (required for npm chaincode)...' -ForegroundColor Cyan
docker pull hyperledger/fabric-nodeenv:2.5

Write-Host 'Installing chaincode npm dependencies...' -ForegroundColor Cyan
Push-Location $ChaincodeDir
npm install --omit=dev
Pop-Location

$Inner = Join-Path $ScriptsDir 'fabric-deploy-inner.sh'
if (-not (Test-Path $Inner)) {
  Write-Error "Missing $Inner"
}

$code = Invoke-FabricCliScript -LocalScriptPath $Inner -Message 'Running channel + chaincode deploy inside cli container...'
if ($code -ne 0) { exit $code }

Write-Host 'Success. Restart the API if it was already running, then retry member registration.' -ForegroundColor Green
