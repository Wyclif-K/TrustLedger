# Dot-source from fabric-deploy.ps1 / fabric-upgrade.ps1
# Runs a bash script inside the Fabric "cli" container without CRLF stdin issues on Windows.

function Invoke-FabricCliScript {
  param(
    [Parameter(Mandatory = $true)]
    [string] $LocalScriptPath,
    [string] $Message = 'Running script in Fabric CLI container...'
  )

  $resolved = (Resolve-Path $LocalScriptPath).Path
  $raw = [System.IO.File]::ReadAllText($resolved)
  $unix = ($raw -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd() + "`n"

  $name = 'tl-fabric-' + [Guid]::NewGuid().ToString('n') + '.sh'
  $tmp = Join-Path $env:TEMP $name
  $remote = "/tmp/$name"

  [System.IO.File]::WriteAllText($tmp, $unix, [System.Text.UTF8Encoding]::new($false))

  try {
    Write-Host $Message -ForegroundColor Cyan
    docker cp $tmp "cli:$remote"
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed (exit $LASTEXITCODE)" }
    docker exec cli bash $remote
    return $LASTEXITCODE
  }
  finally {
    docker exec cli rm -f $remote 2>$null | Out-Null
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}
