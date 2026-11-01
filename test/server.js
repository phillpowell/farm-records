// Local test server: serves the app and pretends to be the Google web app,
// running the real apps-script/Code.gs against a fake Sheet.
// Usage: node test/server.js  → app at http://localhost:8080, fake Google at http://localhost:8081/exec
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createGas } = require('./fake-gas');

const ROOT = path.join(__dirname, '..');
const gas = createGas();
gas.setupSheets();
const KEY = gas.getKey_();

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(8080);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (out) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(out.getContent());
  };
  if (url.pathname === '/__state') { // for tests: look inside the fake Sheet
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ key: KEY, sheets: Object.fromEntries(gas.ss.getSheets().map((s) => [s.name, s.data])), files: gas.files.length }));
    return;
  }
  if (req.method === 'GET') return send(gas.doGet({ parameter: Object.fromEntries(url.searchParams) }));
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => send(gas.doPost({ postData: { contents: body } })));
}).listen(8081, () => console.log(`ready key=${KEY}`));
