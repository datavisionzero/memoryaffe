param([Parameter(Mandatory)][string]$Destination,[string]$EnvFile='deploy/.env',[string]$ProjectName='memoryaffe')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent;Set-Location $root
$destinationPath=[IO.Path]::GetFullPath($Destination)
if(Test-Path $destinationPath){throw 'Backupziel existiert bereits; neues Verzeichnis wählen.'}
$envPath=[IO.Path]::GetFullPath($EnvFile);if(!(Test-Path $envPath)){throw 'Konfigurationsdatei fehlt.'}
New-Item -ItemType Directory $destinationPath|Out-Null
if($IsWindows -or $env:OS -eq 'Windows_NT'){$acl=Get-Acl $destinationPath;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','ContainerInherit,ObjectInherit','None','Allow')));Set-Acl $destinationPath $acl}else{& chmod 700 $destinationPath}
$composeArgs=@('compose','-p',$ProjectName,'-f','deploy/compose.yaml','--env-file',$envPath)
function Dc([Parameter(ValueFromRemainingArguments=$true)][string[]]$Command){& docker @composeArgs @Command;if($LASTEXITCODE){throw "Compose-Schritt fehlgeschlagen: $($Command[0])"}}
$dumpName='memoryaffe-backup-'+[Guid]::NewGuid().ToString('N')+'.dump'
$stopped=$false
try{
 Dc @('stop','app');$stopped=$true
 Dc @('exec','-T','db','pg_dump','-U','memoryaffe','-d','memoryaffe','-Fc','-f',('/tmp/'+$dumpName))
 Dc @('cp',('db:/tmp/'+$dumpName),(Join-Path $destinationPath 'database.dump'))
 Dc @('cp','app:/app/keys',(Join-Path $destinationPath 'keys'))
 Copy-Item -LiteralPath $envPath -Destination (Join-Path $destinationPath 'configuration.env')
 Copy-Item -LiteralPath deploy/images.lock.json -Destination (Join-Path $destinationPath 'images.lock.json')
 $revision=(& git rev-parse HEAD).Trim()
 $image=(& docker @composeArgs images -q app).Trim()
 $dirty=[bool](& git status --porcelain)
 @{formatVersion=1;createdAt=[DateTime]::UtcNow.ToString('o');gitCommit=$revision;gitDirty=$dirty;appImageId=$image;database='PostgreSQL18';keysApplication='memoryaffe';consistentApplicationStop=$true}|ConvertTo-Json|Set-Content (Join-Path $destinationPath 'backup.json')
 Write-Host 'PASS PostgreSQL-Dump, persistierte Data-Protection-Schlüssel und Konfiguration gesichert. Backup enthält Geheimnisse und private Inhalte; geschützt und zusätzlich verschlüsselt aufbewahren.'
}finally{
 try{Dc @('exec','-T','db','rm','-f',('/tmp/'+$dumpName))}catch{Write-Warning 'Temporärer Dump konnte nicht entfernt werden.'}
 if($stopped){Dc @('start','app')}
}
