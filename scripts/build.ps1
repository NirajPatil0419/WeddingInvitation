$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$classesDirectory = Join-Path $projectRoot 'build/classes'

if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
    throw 'Install JDK 21 or newer and add its bin directory to PATH.'
}

New-Item -ItemType Directory -Path $classesDirectory -Force | Out-Null
$sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src/main/java') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
& javac --release 21 -encoding UTF-8 -d $classesDirectory @sourceFiles
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed. JDK 21 or newer is required.' }

& java -cp $classesDirectory com.weddinginvitation.SiteGenerator $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Invitation generation failed.' }
