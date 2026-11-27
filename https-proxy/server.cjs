/**
 * 多项目 HTTPS 服务（同域名 + 路径前缀）
 * - greenlock-express: 自动申请/续期 Let's Encrypt 证书，监听 80/443，80 自动跳 HTTPS
 * - /                → 家庭清单（静态 dist/ + /api 反代到 8791）
 * - /onenest/...     → OneNest（静态 ../onenest/web/ + /onenest/api 反代到 5181）
 *
 * 反代时剥掉项目前缀，后端仍看到原本的 /api/* 路径，无需改动后端代码。
 */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { URL } = require('node:url');

const DOMAIN = process.env.DOMAIN || 'www.boringworld.cn';
const EMAIL = process.env.EMAIL || '15201130117@163.com';
const CONFIG_DIR = path.join(__dirname, 'greenlock.d');

// 项目配置：prefix 为空表示根路径
const PROJECTS = [
  {
    prefix: '',
    staticDir: path.join(__dirname, 'dist'),
    apiPrefix: '/api',
    backendPort: Number(process.env.BACKEND_PORT || 8791),
  },
  {
    prefix: '/onenest',
    staticDir: path.resolve(__dirname, '..', '..', 'onenest', 'web'),
    apiPrefix: '/onenest/api',
    backendPort: Number(process.env.ONENEST_PORT || 5181),
  },
];

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

// 反代：path 为转发给后端的完整 URL（已剥掉项目前缀）
function proxyHandler(req, res, targetPath, port) {
  const options = {
    hostname: '127.0.0.1',
    port,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
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
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      ...headers,
    });
    res.end(data);
  });
}

// 静态文件：stripPrefix 是项目路径前缀（如 /onenest），从请求 pathname 剥掉后再映射到 staticDir
function staticHandler(req, res, project, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Method not allowed');
  }
  let rel = pathname.slice(project.prefix.length) || '/';
  if (!rel.startsWith('/')) rel = '/' + rel;
  const safePath = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const base = project.staticDir;
  let filePath = path.join(base, safePath);
  if (!filePath.startsWith(base)) filePath = path.join(base, 'index.html');
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const cache = filePath.endsWith('index.html') || filePath.endsWith('sw.js')
      ? 'no-cache'
      : 'public, max-age=3600';
    return sendFile(res, filePath, { 'Cache-Control': cache });
  }
  return sendFile(res, path.join(base, 'index.html'), { 'Cache-Control': 'no-cache' });
}

const app = (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `https://${DOMAIN}`).pathname); }
  catch { pathname = '/'; }

  // 按 prefix 长度倒序匹配，确保 /onenest 优先于根路径 ''
  for (const project of [...PROJECTS].sort((a, b) => b.prefix.length - a.prefix.length)) {
    if (project.prefix && pathname !== project.prefix && !pathname.startsWith(project.prefix + '/')) continue;

    // API 请求：剥掉项目前缀的反代部分（/onenest/api → /api）
    if (pathname === project.apiPrefix || pathname.startsWith(project.apiPrefix + '/')) {
      const stripped = pathname.slice(project.prefix.length) + new URL(req.url, `https://${DOMAIN}`).search;
      return proxyHandler(req, res, stripped, project.backendPort);
    }
    // 根项目的静态文件
    if (!project.prefix) return staticHandler(req, res, project, pathname);
    // 子项目静态文件（/onenest 或 /onenest/xxx）
    return staticHandler(req, res, project, pathname);
  }
  return staticHandler(req, res, PROJECTS[0], pathname);
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

console.log(`HTTPS 服务启动： https://${DOMAIN}`);
for (const p of PROJECTS) {
  console.log(`  ${p.prefix || '/'} → 静态 ${p.staticDir} + ${p.apiPrefix} → 127.0.0.1:${p.backendPort}`);
}
console.log('证书由 Let\'s Encrypt 自动申请与续期，配置目录:', CONFIG_DIR);
