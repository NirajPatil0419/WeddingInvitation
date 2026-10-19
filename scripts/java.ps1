# A repository-local JDK keeps this workspace independent of older system Java.
$javaHomePath = $env:JAVA_HOME
$toolchains = Join-Path (Split-Path -Parent $PSScriptRoot) 'build/toolchains'
$localJdk = Get-ChildItem -LiteralPath $toolchains -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($localJdk) { $javaHomePath = $localJdk.FullName }
$javaCommand = if ($javaHomePath) { Join-Path $javaHomePath 'bin/java.exe' } else { 'java' }
$javacCommand = if ($javaHomePath) { Join-Path $javaHomePath 'bin/javac.exe' } else { 'javac' }
foreach ($jdkCommand in @($javaCommand, $javacCommand)) {
    if (-not (Get-Command $jdkCommand -ErrorAction SilentlyContinue)) { throw 'JDK 21 is required. Set JAVA_HOME to its installation directory.' }
    $jdkVersion = (& $jdkCommand --version 2>&1 | Select-Object -First 1).ToString()
    if ($jdkVersion -notmatch '(?:javac|openjdk|java)\s+(\d+)' -or [int]$Matches[1] -lt 21) {
        throw "JDK 21 or newer is required; found $jdkVersion. Set JAVA_HOME to JDK 21."
    }
}
