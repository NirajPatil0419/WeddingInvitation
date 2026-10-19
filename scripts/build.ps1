# Builds the main invitation, or with -Variant <name>, config/variants/<name>.properties into build/variants/<name>.
param([string]$Variant)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$classesDirectory = Join-Path $projectRoot 'build/classes'

. (Join-Path $PSScriptRoot 'java.ps1')

New-Item -ItemType Directory -Path $classesDirectory -Force | Out-Null
$sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src/main/java') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
& $javacCommand --release 21 -encoding UTF-8 -d $classesDirectory @sourceFiles
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed. JDK 21 or newer is required.' }

& $javaCommand '-Djava.awt.headless=true' -cp $classesDirectory com.weddinginvitation.SiteGenerator $projectRoot @(if ($Variant) { $Variant })
if ($LASTEXITCODE -ne 0) { throw 'Invitation generation failed.' }
