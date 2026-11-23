import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? 5173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    if (relative !== 'index.html' && relative !== 'src/levels.json' && !/^src\/[a-z-]+\.(js|css)$/.test(relative)) {
      response.writeHead(404).end('Arquivo não encontrado.');
      return;
    }
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
      response.writeHead(404).end('Arquivo não encontrado.');
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[extname(file)], 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Arquivo não encontrado.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Congestionamento Cerebral — http://127.0.0.1:${port}/`));
