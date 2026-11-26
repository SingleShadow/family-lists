/**
 * 家庭清单网关 — Node 22 内置 http，零第三方依赖。
 *
 * GET    /api/health
 * GET    /api/lists
 * POST   /api/lists            { name, icon?, description?, sortOrder? }
 * PATCH  /api/lists/:id        { name?, icon?, description?, sortOrder? }
 * DELETE /api/lists/:id
 * GET    /api/items?listId=
 * POST   /api/items            { listId, name, qty?, category?, assignee?, note?, restock?, done? }
 * PATCH  /api/items/:id        { ...任意字段 }
 * DELETE /api/items/:id
 * GET    /api/summary
 */
const http = require('node:http');
const { URL } = require('node:url');
const store = require('./db.cjs');

const PORT = Number(process.env.PORT || 8791);
const CORS = process.env.CORS || '*';

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('JSON 格式错误')); }
    });
  });
}

function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') return json(res, 204, {});

  if (method === 'GET' && p === '/api/health') {
    return json(res, 200, { ok: true, service: 'family-lists', time: new Date().toISOString() });
  }

  if (method === 'GET' && p === '/api/lists') {
    const lists = store.listRows().map((l) => ({
      ...l,
      itemCount: store.itemRows(l.id).filter((i) => !i.done).length,
    }));
    return json(res, 200, { items: lists });
  }

  if (method === 'POST' && p === '/api/lists') {
    return readBody(req).then((b) => {
      try { return json(res, 201, store.createList(b)); }
      catch (e) { return json(res, 400, { error: e.message }); }
    }).catch((e) => json(res, 400, { error: e.message }));
  }

  let m = p.match(/^\/api\/lists\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (method === 'PATCH') {
      return readBody(req).then((b) => {
        try {
          const row = store.updateList(id, b);
          return row ? json(res, 200, row) : json(res, 404, { error: '清单不存在' });
        } catch (e) { return json(res, 400, { error: e.message }); }
      }).catch((e) => json(res, 400, { error: e.message }));
    }
    if (method === 'DELETE') {
      return json(res, 200, { ok: store.deleteList(id) });
    }
  }

  if (method === 'GET' && p === '/api/items') {
    const listId = url.searchParams.get('listId') || '';
    return json(res, 200, { items: store.itemRows(listId || null) });
  }

  if (method === 'POST' && p === '/api/items') {
    return readBody(req).then((b) => {
      try { return json(res, 201, store.createItem(b)); }
      catch (e) { return json(res, 400, { error: e.message }); }
    }).catch((e) => json(res, 400, { error: e.message }));
  }

  m = p.match(/^\/api\/items\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (method === 'PATCH') {
      return readBody(req).then((b) => {
        try {
          const row = store.updateItem(id, b);
          return row ? json(res, 200, row) : json(res, 404, { error: '条目不存在' });
        } catch (e) { return json(res, 400, { error: e.message }); }
      }).catch((e) => json(res, 400, { error: e.message }));
    }
    if (method === 'DELETE') {
      return json(res, 200, { ok: store.deleteItem(id) });
    }
  }

  if (method === 'GET' && p === '/api/summary') {
    return json(res, 200, store.summary());
  }

  return json(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  Promise.resolve(route(req, res)).catch((e) => json(res, 500, { error: e.message }));
});

server.listen(PORT, () => {
  console.log(`家庭清单网关已启动: http://localhost:${PORT}`);
});
