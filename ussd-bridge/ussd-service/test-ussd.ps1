# TrustLedger USSD — quick local test (PowerShell)
# Usage: .\test-ussd.ps1
#        .\test-ussd.ps1 -Phone "+256700123456" -Url "http://localhost:4000"

param(
    [string]$Phone = "+256700123456",
    [string]$Url   = "http://localhost:4000",
    [string]$Text  = ""
)

$body = @{
    sessionId   = "ps-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    serviceCode = "*384*13948#"
    phoneNumber = $Phone
    text        = $Text
    networkCode = "63902"
}

Write-Host "POST $Url/ussd  phone=$Phone  text=`"$Text`"" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$Url/ussd" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $body
    Write-Host "`n$response`n" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
    Write-Host "Is the USSD bridge running?  cd ussd-bridge/ussd-service; npm run dev" -ForegroundColor Yellow
}
