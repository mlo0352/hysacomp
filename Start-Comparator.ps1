$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Install Node.js 22.12 or newer, then run this launcher again.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    Write-Host 'Butter starts empty. Load the fictional example or import your own scenario.'
    Write-Host 'The local server stops when you press Ctrl+C.'
    & npm.cmd run dev -- --open --port 0
} finally {
    Pop-Location
}
