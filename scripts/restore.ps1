param([Parameter(Mandatory)][string]$Backup,[Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]+$')][string]$NewProject,[int]$HttpPort=5081,[string]$PublicBaseUrl,[string[]]$AdditionalComposeFiles=@(),[string]$ProxyIp,[string]$ProxySubnet)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent;Set-Location $root
$backupPath=[IO.Path]::GetFullPath($Backup)
foreach($part in 'backup.json','database.dump','configuration.env','keys'){if(!(Test-Path (Join-Path $backupPath $part))){throw "Backupdatei fehlt: $part"}}
$existingContainers=& docker ps -a -q --filter "label=com.docker.compose.project=$NewProject";if($LASTEXITCODE){throw 'Docker nicht verfügbar.'}
$existingVolumes=& docker volume ls -q --filter "label=com.docker.compose.project=$NewProject";if($LASTEXITCODE){throw 'Docker nicht verfügbar.'}
if($existingContainers -or $existingVolumes){throw 'Zielprojekt hat bereits Container oder Volumes. Wiederherstellung ist ausschließlich in ein neues Projekt erlaubt.'}
$workDir=Join-Path $root ('.tools/restore-'+[Guid]::NewGuid().ToString('N'));New-Item -ItemType Directory $workDir|Out-Null
if($IsWindows -or $env:OS -eq 'Windows_NT'){$acl=Get-Acl $workDir;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','ContainerInherit,ObjectInherit','None','Allow')));Set-Acl $workDir $acl}else{& chmod 700 $workDir}
$envPath=Join-Path $workDir '.env';Copy-Item -LiteralPath (Join-Path $backupPath 'configuration.env') -Destination $envPath
$lines=Get-Content $envPath|Where-Object{$_ -notmatch '^MEMORYAFFE_HTTP_PORT=' -and (!$PublicBaseUrl -or $_ -notmatch '^MEMORYAFFE_BASE_URL=')}
$lines+=('MEMORYAFFE_HTTP_PORT='+$HttpPort);if($PublicBaseUrl){$lines+=('MEMORYAFFE_BASE_URL='+$PublicBaseUrl)};$lines|Set-Content $envPath
if($ProxyIp){$lines=$lines|Where-Object{$_ -notmatch '^MEMORYAFFE_PROXY_IP='};$lines+=('MEMORYAFFE_PROXY_IP='+$ProxyIp)}
if($ProxySubnet){$lines=$lines|Where-Object{$_ -notmatch '^MEMORYAFFE_PROXY_SUBNET='};$lines+=('MEMORYAFFE_PROXY_SUBNET='+$ProxySubnet)}
$lines|Set-Content $envPath
$composeArgs=@('compose','-p',$NewProject,'-f','deploy/compose.yaml')
foreach($file in $AdditionalComposeFiles){$composeArgs+=@('-f',$file)}
$composeArgs+=@('--env-file',$envPath)
function Dc([Parameter(ValueFromRemainingArguments=$true)][string[]]$Command){& docker @composeArgs @Command;if($LASTEXITCODE){throw "Compose-Schritt fehlgeschlagen: $($Command[0])"}}
Dc @('up','-d','--wait','db')
Dc @('cp',(Join-Path $backupPath 'database.dump'),'db:/tmp/memoryaffe-restore.dump')
Dc @('exec','-T','db','pg_restore','-U','memoryaffe','-d','memoryaffe','--no-owner','--no-privileges','/tmp/memoryaffe-restore.dump')
Dc @('exec','-T','db','rm','-f','/tmp/memoryaffe-restore.dump')
Dc @('create','app')
Dc @('cp',(Join-Path $backupPath 'keys/.'),'app:/app/keys')
Dc @('run','--rm','--no-deps','--cap-add','CHOWN','--cap-add','FOWNER','--cap-add','DAC_OVERRIDE','--user','0','--entrypoint','sh','app','-c','chown -R 1654:1654 /app/keys && chmod 700 /app/keys && find /app/keys -type f -exec chmod 600 {} +')
Dc @('up','-d')
$ready=$false
for($i=0;$i -lt 60;$i++){try{if((Invoke-WebRequest "http://127.0.0.1:$HttpPort/health/ready" -UseBasicParsing).StatusCode -eq 200){$ready=$true;break}}catch{};Start-Sleep -Seconds 1}
if(!$ready){throw 'Wiederhergestellte Anwendung wird nicht bereit. Quellvolume wurde nicht verändert.'}
Dc @('exec','-T','db','psql','-U','memoryaffe','-d','memoryaffe','-v','ON_ERROR_STOP=1','-c','SELECT count(*) AS restored_accounts FROM "Accounts";')
Write-Host "PASS Wiederherstellung in neues Projekt $NewProject, Readiness200. Vor DNS-/Proxyumschaltung Daten, Login und TOTP am korrekten HTTPS-Ursprung prüfen. Eigene Restorekonfiguration: $envPath. Quellvolumes unverändert."
