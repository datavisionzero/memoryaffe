// Explicit maintenance command: reads primary package registries, never runs packages.
import { writeFileSync } from 'node:fs';
const npm = {
  react:'19.3.1','react-dom':'19.3.1',typescript:'5.9.3',vite:'8.3.8',
  '@vitejs/plugin-react':'6.3.0',tailwindcss:'4.3.5','@tailwindcss/vite':'4.3.5',
  '@base-ui/react':'1.9.0','react-router':'8.5.1',
  '@codemirror/view':'6.43.15','@codemirror/state':'6.7.6','@codemirror/lang-markdown':'6.5.2',
  'react-markdown':'10.1.0','remark-gfm':'4.0.1',vitest:'5.1.0',
  '@testing-library/react':'16.3.3','@testing-library/dom':'10.4.2',
  '@types/react':'19.3.0','@types/react-dom':'19.3.0',jsdom:'31.0.1',
  '@playwright/test':'1.65.0','openapi-typescript':'7.13.0'
};
const nuget = { 'Microsoft.EntityFrameworkCore':'10.0.15','Microsoft.AspNetCore.OpenApi':'10.0.15',
  'Microsoft.AspNetCore.Identity.EntityFrameworkCore':'10.0.15','Npgsql.EntityFrameworkCore.PostgreSQL':'10.0.3',
  'ModelContextProtocol.AspNetCore':'2.4.0',xunit:'2.9.3','Testcontainers.PostgreSql':'4.16.0' };
async function get(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}: ${url}`); return r.json(); }
const entries = await Promise.all([
  ...Object.entries(npm).map(async ([name,version]) => { const source=`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`; const p=await get(source); return { ecosystem:'npm', name,version,source,license:p.license,engines:p.engines??{},peerDependencies:p.peerDependencies??{},peerDependenciesMeta:p.peerDependenciesMeta??{},integrity:p.dist.integrity }; }),
  ...Object.entries(nuget).map(async ([name,version]) => { const source=`https://api.nuget.org/v3/registration5-gz-semver2/${name.toLowerCase()}/${version}.json`; const r=await get(source); const p=await get(r.catalogEntry); return {ecosystem:'nuget',name,version,source,license:p.licenseExpression??p.licenseUrl,dependencyGroups:p.dependencyGroups??[]}; })
]);
entries.sort((a,b)=>a.ecosystem.localeCompare(b.ecosystem)||a.name.localeCompare(b.name));
writeFileSync(new URL('dependencies.snapshot.json',import.meta.url),JSON.stringify({checkedAt:'2026-11-13',status:'Registry metadata verified; restore/build and full transitive license audit required in bootstrap.',runtimes:{dotnetSdk:'10.0.404',dotnetRuntime:'10.0.15',node:'24.22.3',go:'1.27.4',postgres:'18.7'},packages:entries},null,2)+'\n');
console.log(`Recorded ${entries.length} direct dependency versions and registry license/compatibility metadata.`);
