param([int]$Port=5080,[int]$DatabasePort=55432,[switch]$NoBuild)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
if($env:LOCALAPPDATA){$localNode=Join-Path $env:LOCALAPPDATA 'memoryaffe-toolchains/node/node-v24.22.3-win-x64';if(Test-Path (Join-Path $localNode 'node.exe')){$env:PATH="$localNode;$env:PATH"}}
if($env:LOCALAPPDATA){$localDotnet=Join-Path $env:LOCALAPPDATA 'memoryaffe-tools/dotnet';if(Test-Path (Join-Path $localDotnet 'dotnet.exe')){$env:DOTNET_ROOT=$localDotnet;$env:PATH="$localDotnet;$env:PATH"}}
$probeClient=[Net.Sockets.TcpClient]::new()
try{if($probeClient.ConnectAsync('127.0.0.1',$Port).Wait(300) -and $probeClient.Connected){throw "Appport $Port ist bereits belegt. Vorhandenen Prozess ausdrücklich stoppen oder anderen Port wählen."}}catch [AggregateException]{}finally{$probeClient.Dispose()}
$settingsPath=Join-Path $root '.tools/dev-settings.json'
if(!(Test-Path $settingsPath)){
 New-Item -ItemType Directory -Force (Split-Path $settingsPath) | Out-Null
 $cfg=@{DatabasePassword=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32));SetupSecret=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))}
 $cfg|ConvertTo-Json|Set-Content $settingsPath
 if($IsWindows -or $env:OS -eq 'Windows_NT'){$acl=Get-Acl $settingsPath;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow')));Set-Acl $settingsPath $acl}else{& chmod 600 $settingsPath}
}
$cfg=Get-Content $settingsPath -Raw|ConvertFrom-Json
$env:DEV_DATABASE_PASSWORD=$cfg.DatabasePassword;$env:DEV_DATABASE_PORT=[string]$DatabasePort
& docker compose -f deploy/compose.dev.yaml up -d --wait
if($LASTEXITCODE){throw 'PostgreSQL konnte nicht gestartet werden.'}
$appDir=Join-Path $root '.tools/dev-app'
if(!$NoBuild){
 & npm ci --prefix src/web --no-audit --no-fund;if($LASTEXITCODE){throw 'npm ci fehlgeschlagen.'}
 & npm run build --prefix src/web;if($LASTEXITCODE){throw 'Webbuild fehlgeschlagen.'}
 & dotnet restore memoryaffe.sln --locked-mode;if($LASTEXITCODE){throw '.NET-Restore fehlgeschlagen.'}
 & dotnet publish src/Memoryaffe.Api -c Release --no-restore -o $appDir -p:UseAppHost=false;if($LASTEXITCODE){throw '.NET-Publish fehlgeschlagen.'}
 Copy-Item -Path src/web/dist/* -Destination (New-Item -ItemType Directory -Force (Join-Path $appDir 'wwwroot')) -Recurse -Force
}
if(!(Test-Path (Join-Path $appDir 'Memoryaffe.Api.dll'))){throw 'Noch kein Build vorhanden.'}
$env:ASPNETCORE_ENVIRONMENT='Development';$env:ASPNETCORE_URLS="http://127.0.0.1:$Port";$env:Memoryaffe__BaseUrl="http://127.0.0.1:$Port";$env:Memoryaffe__SetupSecret=$cfg.SetupSecret;$env:Memoryaffe__KeyDirectory=Join-Path $root '.tools/dev-keys';$env:MEMORYAFFE_IMPORT_DIRECTORY=Join-Path $root '.tools/dev-imports';$env:ConnectionStrings__Database="Host=127.0.0.1;Port=$DatabasePort;Database=memoryaffe;Username=memoryaffe;Password=$($cfg.DatabasePassword)"
$appArguments=@('"'+(Join-Path $appDir 'Memoryaffe.Api.dll')+'"')
if($IsWindows -or $env:OS -eq 'Windows_NT'){$process=Start-Process dotnet -ArgumentList $appArguments -WorkingDirectory $appDir -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.tools/dev-api.log') -RedirectStandardError (Join-Path $root '.tools/dev-api-error.log')}else{$process=Start-Process dotnet -ArgumentList $appArguments -WorkingDirectory $appDir -PassThru -RedirectStandardOutput (Join-Path $root '.tools/dev-api.log') -RedirectStandardError (Join-Path $root '.tools/dev-api-error.log')}
$process.Id|Set-Content (Join-Path $root '.tools/dev-api.pid')
$ready=$false
for($i=0;$i -lt 60;$i++){try{if((Invoke-WebRequest "http://127.0.0.1:$Port/health/ready" -UseBasicParsing).StatusCode -eq 200){$ready=$true;break}}catch{};Start-Sleep -Seconds 1}
if(!$ready){throw 'Anwendung nicht bereit. Lokale .tools/dev-api-error.log prüfen.'}
Write-Host "memoryaffe läuft unter http://127.0.0.1:$Port. Betreibersecret liegt ausschließlich in .tools/dev-settings.json; dort lokal ablesen. PID $($process.Id). Datenbankvolume bleibt erhalten."
