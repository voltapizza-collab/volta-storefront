param(
    [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$Jdk = 'C:\Program Files\Android\Android Studio\jbr',
    [string]$BuildTools = '36.0.0',
    [ValidateSet('usb', 'https')][string]$Connection = 'usb'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:JAVA_HOME = $Jdk
$env:Path = "$Jdk\bin;$env:Path"
$bt = Join-Path $Sdk "build-tools\$BuildTools"
$android = Join-Path $Sdk 'platforms\android-34\android.jar'
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw "Build command failed: $LASTEXITCODE" } }
New-Item -ItemType Directory -Force -Path build,libs,build\classes,build\dex | Out-Null
$variantRoot = Join-Path (Join-Path $PSScriptRoot 'build') ('variant-' + [guid]::NewGuid().ToString('N'))
$variantClasses = Join-Path $variantRoot 'classes'
$variantResources = Join-Path $variantRoot 'res'
New-Item -ItemType Directory -Force -Path $variantClasses,$variantResources | Out-Null
Copy-Item -Path res\* -Destination $variantResources -Recurse -Force
$serverUrl = if ($Connection -eq 'https') { 'https://api.voltapizza.com' } else { 'http://127.0.0.1:8091' }
$configSource = Join-Path $variantRoot 'ConnectionConfig.java'
Set-Content -LiteralPath $configSource -Encoding utf8 -Value "package com.volta.poslab; public final class ConnectionConfig { public static final String SERVER_URL = `"$serverUrl`"; }"
if ($Connection -eq 'https') {
    Set-Content -LiteralPath (Join-Path $variantResources 'xml/network_security_config.xml') -Encoding utf8 -Value '<network-security-config><base-config cleartextTrafficPermitted="false" /></network-security-config>'
}
$variantManifest = Join-Path $variantRoot 'AndroidManifest.xml'
$manifestText = (Get-Content AndroidManifest.xml -Raw).Replace('android:versionCode="2"','android:versionCode="7"').Replace('android:versionName="0.2.0"', "android:versionName=`"0.3.4-$Connection`"")
Set-Content -LiteralPath $variantManifest -Encoding utf8 -Value $manifestText
$apkOutput = if ($Connection -eq 'https') { 'build\volta-pos-connected-0.3.4.apk' } else { 'build\volta-pos-pilot-0.2.0.apk' }
if (!(Test-Path libs\printerx-1.0.20.aar)) {
    Invoke-WebRequest 'https://repo.maven.apache.org/maven2/com/sunmi/printerx/1.0.20/printerx-1.0.20.aar' -OutFile libs\printerx-1.0.20.aar
}
if ((Get-FileHash libs\printerx-1.0.20.aar -Algorithm SHA256).Hash -ne '04ADA9F3D0B2DCD28C4E6D3A41F40FF59EA85BE1D7ECB34924AAB0F32A5AD42C') {
    throw 'Unexpected checksum for SUNMI PrinterX 1.0.20'
}
Push-Location build
try { & "$Jdk\bin\jar.exe" xf ..\libs\printerx-1.0.20.aar classes.jar; Check-Exit } finally { Pop-Location }
$sources = @(Get-ChildItem src -Recurse -Filter *.java | Select-Object -ExpandProperty FullName) + @($configSource)
& "$Jdk\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath "$android;build\classes.jar" -d $variantClasses $sources
Check-Exit
& "$Jdk\bin\jar.exe" cf build\app-classes.jar -C $variantClasses .
Check-Exit
& "$bt\d8.bat" --lib $android --min-api 23 --output build\dex build\app-classes.jar build\classes.jar
Check-Exit
& "$bt\aapt2.exe" compile --dir $variantResources -o build\resources.zip
Check-Exit
& "$bt\aapt2.exe" link -o build\unsigned.apk -I $android --manifest $variantManifest build\resources.zip
Check-Exit
& "$Jdk\bin\jar.exe" uf build\unsigned.apk -C build\dex classes.dex
Check-Exit
if (!(Test-Path build\packaged\assets\pos\index.html)) { throw 'Build native POS interface first: node scripts/build-native-pos.cjs in volta-storefront' }
& "$Jdk\bin\jar.exe" uf build\unsigned.apk -C build\packaged assets
Check-Exit
& "$bt\zipalign.exe" -f 4 build\unsigned.apk build\aligned.apk
Check-Exit
if (!(Test-Path build\lab.keystore)) {
    throw 'Signing key missing. Restore the approved signing key to build/lab.keystore; never generate a replacement for existing terminals.'
}
& "$bt\apksigner.bat" sign --ks build\lab.keystore --ks-pass pass:android --key-pass pass:android --out $apkOutput build\aligned.apk
Check-Exit
& "$bt\apksigner.bat" verify --verbose $apkOutput
Check-Exit
Get-FileHash $apkOutput -Algorithm SHA256
