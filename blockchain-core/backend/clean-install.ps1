# TrustLedger backend — clean install on Windows (fixes EPERM on node_modules)
# Run from PowerShell:  cd blockchain-core\backend   .\clean-install.ps1

$ErrorActionPreference = "Stop"
Write-Host "Stopping Node processes that may lock node_modules (optional close VS Code terminals running this server)..." -ForegroundColor Yellow

Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path node_modules) {
  Write-Host "Removing node_modules..." -ForegroundColor Cyan
  Remove-Item -Recurse -Force node_modules
}
if (Test-Path package-lock.json) {
  Remove-Item -Force package-lock.json
}

Write-Host "npm install..." -ForegroundColor Cyan
npm install
