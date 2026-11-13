#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
base="http://127.0.0.1:5080"
if curl -fsS "$base/health/live" >/dev/null 2>&1; then echo 'Ein Server läuft bereits auf Testport5080. Dedizierten CI-Host verwenden.' >&2; exit 1; fi
if docker inspect memoryaffe-dev-pg >/dev/null 2>&1; then echo 'Testcontainername bereits belegt; bestehende Container bleiben unangetastet.' >&2; exit 1; fi
mkdir -p .tools/ci-keys .tools/ci-imports .tools/ci-app/wwwroot
export DEV_DATABASE_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export Memoryaffe__SetupSecret="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export MEMORYAFFE_TEST_ADMIN_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export MEMORYAFFE_TEST_ADMIN_EMAIL='browser@memoryaffe.test'
export MEMORYAFFE_TEST_SETUP_SECRET="$Memoryaffe__SetupSecret"
export MEMORYAFFE_TEST_BASE_URL="$base"
export MEMORYAFFE_TEST_GO="$(command -v go)"
export MEMORYAFFE_TEST_DATABASE_PASSWORD="$DEV_DATABASE_PASSWORD"
export MEMORYAFFE_TEST_DATABASE_NAME=memoryaffe
export MEMORYAFFE_TEST_API_ASSEMBLY="$root/.tools/ci-app/Memoryaffe.Api.dll"
export MEMORYAFFE_TEST_TOTP=1 MEMORYAFFE_TEST_OAUTH=1 MEMORYAFFE_TEST_ARCHIVES=1 MEMORYAFFE_TEST_SEARCH=1
export MEMORYAFFE_TEST_LIFECYCLE=1 MEMORYAFFE_TEST_ADMIN_RACE=1
export Memoryaffe__TestRateMultiplier=20
export E2E_EMAIL="$MEMORYAFFE_TEST_ADMIN_EMAIL" E2E_PASSWORD="$MEMORYAFFE_TEST_ADMIN_PASSWORD" SETUP_SECRET="$Memoryaffe__SetupSecret" WEB_URL="$base"
export ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="$base" Memoryaffe__BaseUrl="$base"
export ConnectionStrings__Database="Host=127.0.0.1;Port=55432;Database=memoryaffe;Username=memoryaffe;Password=$DEV_DATABASE_PASSWORD"
export Memoryaffe__KeyDirectory="$root/.tools/ci-keys" MEMORYAFFE_IMPORT_DIRECTORY="$root/.tools/ci-imports"
export MEMORYAFFE_TEST_CIMD_FILE="$root/.tools/ci-cimd.json" MEMORYAFFE_TEST_ALLOWED_CLIENTS_FILE="$root/.tools/ci-allowed.json"
export Memoryaffe__TestCimdFile="$MEMORYAFFE_TEST_CIMD_FILE" Memoryaffe__AllowedClientsFile="$MEMORYAFFE_TEST_ALLOWED_CLIENTS_FILE"
node --input-type=module -e 'import{writeFileSync}from"node:fs";const id="https://client.example.test/metadata.json";writeFileSync(process.env.MEMORYAFFE_TEST_ALLOWED_CLIENTS_FILE,JSON.stringify([id]));writeFileSync(process.env.MEMORYAFFE_TEST_CIMD_FILE,JSON.stringify({[id]:{client_id:id,client_name:"Controlled protocol test",redirect_uris:["https://client.example.test/callback"],grant_types:["authorization_code","refresh_token"],response_types:["code"],token_endpoint_auth_methods_supported:["none"],testCacheSeconds:0}}));'
created=0
app_pid=''
cleanup(){ if [[ -n "$app_pid" ]]; then kill "$app_pid" 2>/dev/null || true; fi; if [[ "$created" = 1 ]]; then docker rm -f memoryaffe-dev-pg >/dev/null; fi; }
trap cleanup EXIT
# This container is created by this invocation; no existing container or named volume is removed.
docker run -d --name memoryaffe-dev-pg --label memoryaffe.ci=true -e POSTGRES_DB=memoryaffe -e POSTGRES_USER=memoryaffe -e POSTGRES_PASSWORD="$DEV_DATABASE_PASSWORD" -p 127.0.0.1:55432:5432 postgres:18.7-bookworm@sha256:ece55f7868da684e400f82f1030a050718adbdd65c23aa500c486f6e2950dc0f >/dev/null
created=1
for _ in $(seq 1 60); do if docker exec memoryaffe-dev-pg pg_isready -U memoryaffe -d memoryaffe >/dev/null 2>&1; then break; fi; sleep 1; done
dotnet publish src/Memoryaffe.Api -c Release --no-restore -o .tools/ci-app -p:UseAppHost=false
cp -R src/web/dist/. .tools/ci-app/wwwroot/
pushd .tools/ci-app >/dev/null
dotnet Memoryaffe.Api.dll >../ci-api.log 2>&1 &
app_pid=$!
popd >/dev/null
ready=0
for _ in $(seq 1 60); do if curl -fsS "$base/health/ready" >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
if [[ "$ready" != 1 ]]; then echo 'API wird nicht bereit. Private lokale Logs prüfen.' >&2; exit 1; fi
node tests/integration/api-cli.mjs
dotnet run --project tests/Memoryaffe.ProtocolTests -c Release --no-restore
npm run test:e2e --prefix src/web
