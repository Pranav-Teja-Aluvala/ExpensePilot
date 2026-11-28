import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/web/', 'web/index.html'],
  ['/web/index.html', 'web/index.html'],
  ['/web/styles.css', 'web/styles.css'],
  ['/web/app.mjs', 'web/app.mjs'],
  ['/web/demo.mjs', 'web/demo.mjs'],
  ['/web/statement.mjs', 'web/statement.mjs'],
  ['/web/statement-worker.mjs', 'web/statement-worker.mjs'],
  ['/web/ledger-store.mjs', 'web/ledger-store.mjs'],
  ['/utils/exportImport.js', 'utils/exportImport.js'],
  ['/utils/merchantEngine.js', 'utils/merchantEngine.js'],
  ['/assets/icon.png', 'assets/icon.png'],
]);
const media = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', png: 'image/png' };
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const port = Number(process.env.EXPENSEPILOT_PORT ?? 4175);

const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const path = (request.url ?? '').split('?')[0];
  if (path === '/' || path === '/web') {
    response.writeHead(302, { Location: '/web/' }).end();
    return;
  }
  const file = files.get(path);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(new URL(`../${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': media[file.split('.').at(-1)], 'Content-Length': bytes.length });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(500).end();
  }
});

server.listen(port, '127.0.0.1', () => console.log(`ExpensePilot is running at http://127.0.0.1:${server.address().port}/web/`));
