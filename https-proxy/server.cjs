/**
 * 家庭清单 HTTPS 反向代理
 * greenlock-express: 自动申请/续期 Let's Encrypt 证书，监听 80/443
 * 80 端口自动 301 到 HTTPS，443 反代到本机 8791 网关
 */
const path = require('node:path');
const http = require('node:http');

const DOMAIN = process.env.DOMAIN || 'www.boringworld.cn';
const EMAIL = process.env.EMAIL || '15201130117@163.com';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8791);
const CONFIG_DIR = path.join(__dirname, 'greenlock.d');

// 反代到本机网关：把请求原样转发，保留路径/方法/body/headers
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

const app = (req, res) => proxyHandler(req, res);

require('greenlock-express')
  .init({
    packageRoot: __dirname,
    configDir: CONFIG_DIR,
    maintainerEmail: EMAIL,
    cluster: false,
    // 用 Let's Encrypt 生产环境
    directoryUrl: 'https://acme-v02.api.letsencrypt.org/directory',
  })
  .serve(app);

console.log(`HTTPS 反代启动： https://${DOMAIN} -> http://127.0.0.1:${BACKEND_PORT}`);
console.log('证书由 Let\'s Encrypt 自动申请与续期，配置目录:', CONFIG_DIR);
