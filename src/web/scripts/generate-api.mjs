import openapiTS,{astToString}from'openapi-typescript';
import{readFile,writeFile}from'node:fs/promises';
const source=new URL('../../../docs/contracts/web.openapi.json',import.meta.url);
const target=new URL('../src/generated/web-api.d.ts',import.meta.url);
const output=astToString(await openapiTS(source));
if(process.argv.includes('--check')){if(await readFile(target,'utf8').catch(()=>null)!==output){process.stderr.write('Web-API-Typen weichen vom Vertrag ab. npm run generate:api --prefix src/web ausführen.\n');process.exitCode=1}}else await writeFile(target,output);
