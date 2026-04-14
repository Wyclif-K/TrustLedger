# TrustLedger admin dashboard — clean install on Windows
# Run:  cd blockchain-core\admin-dashboard   .\clean-install.ps1

$ErrorActionPreference = "Stop"

Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path node_modules) {
  Write-Host "Removing node_modules..." -ForegroundColor Cyan
  Remove-Item -Recurse -Force node_modules
}
if (Test-Path package-lock.json) {
  Remove-Item -Force package-lock.json
}

Write-Host "npm install (Vite 5 + @vitejs/plugin-react 4)..." -ForegroundColor Cyan
npm install
