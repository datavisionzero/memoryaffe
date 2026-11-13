#!/bin/sh
set -eu
cd /cli
go version
go test -race -count=1 ./...
go vet ./...
go build -o /tmp/memoryaffe .
go build -o /tmp/linux-proxy /test/linux-proxy.go
go build -o /tmp/linux-smoke /test/linux-smoke.go
/tmp/linux-proxy >/tmp/linux-proxy.log 2>&1 &
proxy_pid=$!
trap 'kill "$proxy_pid" 2>/dev/null || true' EXIT
sleep 1
/tmp/linux-smoke
