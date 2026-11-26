/**
 * 家庭清单 HTTPS 服务
 * - greenlock-express: 自动申请/续期 Let's Encrypt 证书，监听 80/443，80 自动跳 HTTPS
 * - /api/* 反代到本机 8791 网关
 * - 其余路径提供前端静态文件 dist/（同源部署，PWA 完整可用）
 */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { URL } = require('node:url');

const DOMAIN = process.env.DOMAIN || 'www.boringworld.cn';
const EMAIL = process.env.EMAIL || '15201130117@163.com';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8791);
const CONFIG_DIR = path.join(__dirname, 'greenlock.d');
const STATIC_DIR = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// 反代到本机网关：原样转发路径/方法/body/headers
function proxyHandler(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[proxy] error:', err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '后端服务不可用', detail: err.message }));
  });
  req.pipe(proxyReq);
}

function sendFile(res, filePath, headers = {}) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', ...headers });
    res.end(data);
  });
}

// 静态文件：防目录穿越，SPA 兜底到 index.html
function staticHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Method not allowed');
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `https://${DOMAIN}`).pathname); }
  catch { pathname = '/'; }
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(STATIC_DIR, safePath);
  if (!filePath.startsWith(STATIC_DIR)) filePath = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const cache = filePath.endsWith('index.html') || filePath.endsWith('sw.js')
      ? 'no-cache'
      : 'public, max-age=3600';
    return sendFile(res, filePath, { 'Cache-Control': cache });
  }
  // SPA fallback
  return sendFile(res, path.join(STATIC_DIR, 'index.html'), { 'Cache-Control': 'no-cache' });
}

const app = (req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/api') return proxyHandler(req, res);
  return staticHandler(req, res);
};

require('greenlock-express')
  .init({
    packageRoot: __dirname,
    configDir: CONFIG_DIR,
    maintainerEmail: EMAIL,
    cluster: false,
    directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
  })
  .serve(app);

console.log(`HTTPS 服务启动： https://${DOMAIN}  (静态 ${STATIC_DIR} + /api -> 127.0.0.1:${BACKEND_PORT})`);
console.log('证书由 Let\'s Encrypt 自动申请与续期，配置目录:', CONFIG_DIR);
