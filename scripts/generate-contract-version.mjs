import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

const contractPath = new URL('../contracts/openapi/superartillery.yaml', import.meta.url);
const contract = parse(await readFile(contractPath, 'utf8'));
const contractVersion = contract?.info?.version;
const corePackage = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'));
const coreVersion = corePackage?.version;

if (typeof contractVersion !== 'string' || !contractVersion.trim()) {
  throw new Error('The OpenAPI contract must define a non-empty info.version');
}
if (typeof coreVersion !== 'string' || !coreVersion.trim()) {
  throw new Error('The core package must define a non-empty version');
}

const generatedSource = `// Generated from contracts/openapi/superartillery.yaml. Do not edit manually.\nexport const CONTRACT_VERSION = ${JSON.stringify(contractVersion)};\n`;

await writeFile(
  new URL('../packages/core/src/contract/contract-version.ts', import.meta.url),
  generatedSource
);

await writeFile(
  new URL('../packages/core/src/core-version.ts', import.meta.url),
  `// Generated from packages/core/package.json. Do not edit manually.\nexport const CORE_VERSION = ${JSON.stringify(coreVersion)};\n`
);

console.log(`Generated contract version ${contractVersion} and core version ${coreVersion}`);