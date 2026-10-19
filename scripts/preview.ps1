param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build.ps1')
. (Join-Path $PSScriptRoot 'java.ps1')

Write-Host "Preview: http://127.0.0.1:$Port (Ctrl+C to stop)"
& $javaCommand -m jdk.httpserver --bind-address 127.0.0.1 --port $Port --directory (Join-Path $projectRoot 'dist')
if ($LASTEXITCODE -ne 0) { throw 'Preview server failed to start or stopped with an error.' }
