param([string]$BaseUrl='http://127.0.0.1:5080')
$ErrorActionPreference='Stop'
foreach($path in '/health/live','/health/ready','/api/v1/setup','/api/v1/auth/csrf'){
 $r=Invoke-WebRequest ($BaseUrl.TrimEnd('/')+$path) -UseBasicParsing
 if($r.StatusCode -ne 200){throw "Smoke fehlgeschlagen: $path"}
 Write-Host "PASS $path"
}
$r=Invoke-WebRequest $BaseUrl -UseBasicParsing
if($r.Content -notmatch '<div id="root">'){throw 'Webapp wird nicht aus demselben Ursprung ausgeliefert.'}
Write-Host 'PASS Webapp gleicher Ursprung'
