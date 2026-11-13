# syntax=docker/dockerfile:1.7
FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS web
WORKDIR /build/src/web
COPY src/web/package.json src/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY docs/contracts/web.openapi.json /build/docs/contracts/web.openapi.json
COPY src/web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.404-noble@sha256:fe0fd4e93bd2fbb47c883b7a6369e5c8d3db8bf01cdc5981f6ee35fbdf3ff4fb AS server
WORKDIR /build
COPY global.json Directory.Build.props ./
COPY src/Memoryaffe.Domain/ src/Memoryaffe.Domain/
COPY src/Memoryaffe.Application/ src/Memoryaffe.Application/
COPY src/Memoryaffe.Infrastructure/ src/Memoryaffe.Infrastructure/
COPY src/Memoryaffe.Api/ src/Memoryaffe.Api/
COPY docs/contracts/ docs/contracts/
RUN dotnet restore src/Memoryaffe.Api/Memoryaffe.Api.csproj --locked-mode
RUN dotnet publish src/Memoryaffe.Api/Memoryaffe.Api.csproj -c Release --no-restore -o /publish -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.15-noble@sha256:bfd912c83295ce66d4b706ebb8541b9f14259b0e76fbb88b2751f58ce2399d2e
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0 \
    Memoryaffe__KeyDirectory=/app/keys \
    MEMORYAFFE_IMPORT_DIRECTORY=/app/imports
COPY --from=server /publish/ ./
COPY --from=web /build/src/web/dist/ ./wwwroot/
COPY LICENSE THIRD_PARTY_NOTICES.txt /app/
COPY docs/licenses/ /app/licenses/
COPY src/Memoryaffe.Infrastructure/Unicode/LICENSE.txt /app/licenses/Unicode17.txt
RUN mkdir -p /app/keys /app/imports && chown -R "$APP_UID:$APP_UID" /app/keys /app/imports
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Memoryaffe.Api.dll"]
