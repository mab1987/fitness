// Servidor local para teste de ponta a ponta: entrega o app (pasta dist-teste) e responde /api com o backend simulado.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { criarAmbiente } = require('./simulador-gas');

const { ctx, props } = criarAmbiente();
ctx.setup();
props.ADMIN_EMAIL = 'admin@exemplo.com';
props.APP_URL = 'http://localhost:8787/';
const raiz = path.join(__dirname, '..', 'frontend', 'dist-teste');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api') {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      const saida = ctx.doPost({ postData: { contents: corpo } }).getContent();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(saida);
    });
    return;
  }
  const arq = path.join(raiz, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
}).listen(8787, () => console.log('http://localhost:8787'));
