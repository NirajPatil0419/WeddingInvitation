$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = 'node'
$localNode = Join-Path $projectRoot 'build/toolchains/node22/node.exe'
if (Test-Path -LiteralPath $localNode) { $nodeCommand = $localNode }
if (-not (Get-Command $nodeCommand -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 and run npm ci first.' }
& $nodeCommand (Join-Path $projectRoot 'scripts/test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Invitation checks failed.' }
