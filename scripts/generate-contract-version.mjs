import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

const contractPath = new URL('../contracts/openapi/superartillery.yaml', import.meta.url);
const contract = parse(await readFile(contractPath, 'utf8'));
const contractVersion = contract?.info?.version;
const clientPackage = JSON.parse(await readFile(new URL('../client/package.json', import.meta.url), 'utf8'));
const clientVersion = clientPackage?.version;

if (typeof contractVersion !== 'string' || !contractVersion.trim()) {
  throw new Error('The OpenAPI contract must define a non-empty info.version');
}

if (typeof clientVersion !== 'string' || !clientVersion.trim()) {
  throw new Error('The client package must define a non-empty version');
}

const generatedSource = `// Generated from contracts/openapi/superartillery.yaml. Do not edit manually.\nexport const CONTRACT_VERSION = ${JSON.stringify(contractVersion)};\n`;
const generatedClientSource = `// Generated from client/package.json. Do not edit manually.\nexport const CLIENT_VERSION = ${JSON.stringify(clientVersion)};\n`;

await Promise.all([
  writeFile(new URL('../server/src/contract-version.ts', import.meta.url), generatedSource),
  writeFile(new URL('../client/src/ts/contract-version.ts', import.meta.url), generatedSource),
  writeFile(new URL('../client/src/ts/client-version.ts', import.meta.url), generatedClientSource)
]);

console.log(`Generated contract version ${contractVersion} and client version ${clientVersion}`);