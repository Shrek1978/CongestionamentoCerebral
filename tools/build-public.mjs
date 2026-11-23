import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeCatalog } from '../src/catalog.js';

const source = new URL('../', import.meta.url);
const output = new URL('publicacao/', source);
const snapshot = await readFile(new URL('src/levels.json', source), 'utf8');
const levels = decodeCatalog(JSON.parse(snapshot.replace(/^\uFEFF/, '')));
const embedded = JSON.stringify(snapshot).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const module = [
  "// Gerado por npm run build. Edite src/levels.json no projeto e gere novamente.",
  "import { decodeCatalog } from './catalog.js';",
  `export const CATALOG_SNAPSHOT = ${embedded};`,
  "export const LEVELS = decodeCatalog(JSON.parse(CATALOG_SNAPSHOT.replace(/^\\uFEFF/, '')));",
  ''
].join('\n');

await mkdir(output, { recursive: true });
await cp(new URL('src/', source), new URL('src/', output), {
  recursive: true,
  filter: from => !['levels.js', 'levels.json'].includes(basename(from))
});
await Promise.all([
  cp(new URL('index.html', source), new URL('index.html', output)),
  writeFile(new URL('src/levels.js', output), module, 'utf8'),
  writeFile(new URL('src/levels.json', output), snapshot, 'utf8')
]);
console.log(`Publicação pronta: ${fileURLToPath(output)} (${levels.length} desafios).`);
