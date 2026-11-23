import { decodeCatalog } from './catalog.js';

const catalogURL = new URL('./levels.json', import.meta.url);

async function readSnapshot() {
  if (typeof document === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    return readFile(catalogURL, 'utf8');
  }
  const response = await fetch(catalogURL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`O servidor retornou HTTP ${response.status} ao carregar levels.json.`);
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
}

export const CATALOG_SNAPSHOT = await readSnapshot();
export const LEVELS = decodeCatalog(JSON.parse(CATALOG_SNAPSHOT.replace(/^\uFEFF/, '')));
