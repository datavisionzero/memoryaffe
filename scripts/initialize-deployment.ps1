param([Parameter(Mandatory)][string]$PublicBaseUrl,[string]$EnvFile='deploy/.env')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent;Set-Location $root
$uri=[Uri]$PublicBaseUrl
if(!$uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo){throw 'Eine feste HTTPS-Origin ohne Pfad/Query/Fragment/Anmeldedaten angeben.'}
$path=[IO.Path]::GetFullPath($EnvFile);if(Test-Path $path){throw 'Konfiguration existiert bereits und wird nicht überschrieben.'}
$db=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32));$setup=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
@("POSTGRES_PASSWORD=$db","MEMORYAFFE_SETUP_SECRET=$setup",('MEMORYAFFE_BASE_URL='+$PublicBaseUrl.TrimEnd('/')),("MEMORYAFFE_DATABASE_CONNECTION=Host=db;Port=5432;Database=memoryaffe;Username=memoryaffe;Password=$db"),('MEMORYAFFE_HOST='+$uri.Authority),'MEMORYAFFE_HTTP_PORT=5080')|Set-Content $path
if($IsWindows -or $env:OS -eq 'Windows_NT'){$acl=Get-Acl $path;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow')));Set-Acl $path $acl}else{& chmod 600 $path}
Write-Host 'Private Deploymentkonfiguration mit zufälligem Datenbankpasswort und Betreibersecret angelegt. Keine Geheimnisse wurden ausgegeben.'
