# Builds and publishes every invitation to production: the main one (the Vercel project linked in .vercel/)
# and one per config/variants/<name>.properties, each to the Vercel project named <name>.
# Needs VERCEL_TOKEN=... in config/.env.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:Path = "$(Join-Path $projectRoot 'build/toolchains/node22');$env:Path"
$tokenLine = Get-Content (Join-Path $projectRoot 'config/.env') | Where-Object { $_ -match '^VERCEL_TOKEN=' } | Select-Object -First 1
if (-not $tokenLine) { throw 'Add VERCEL_TOKEN=... to config/.env first.' }
$env:VERCEL_TOKEN = ($tokenLine -replace '^VERCEL_TOKEN=', '').Trim()

function Publish([string]$directory) {
    npx --yes vercel@latest deploy --prebuilt --prod --yes --cwd $directory
    if ($LASTEXITCODE -ne 0) { throw "Publishing $directory failed." }
}

& (Join-Path $PSScriptRoot 'build.ps1')
Publish $projectRoot

foreach ($variant in Get-ChildItem (Join-Path $projectRoot 'config/variants') -Filter '*.properties') {
    $name = $variant.BaseName
    & (Join-Path $PSScriptRoot 'build.ps1') -Variant $name
    $directory = Join-Path $projectRoot "build/variants/$name"
    if (-not (Test-Path (Join-Path $directory '.vercel/project.json'))) {
        # Creates the project on first use. Its optional GitHub connection may fail; the link itself is what matters.
        npx --yes vercel@latest link --yes --project $name --cwd $directory
        if (-not (Test-Path (Join-Path $directory '.vercel/project.json'))) { throw "Linking Vercel project $name failed." }
    }
    Publish $directory
}
