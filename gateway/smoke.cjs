/**
 * 网关冒烟测试：node gateway/smoke.cjs
 * 需网关已启动。验证清单/条目 CRUD、勾选、汇总。
 */
const BASE = process.env.BASE || 'http://localhost:8791';

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓ ' + msg);
}

(async () => {
  console.log('=== 家庭清单网关冒烟测试 ===');
  const health = await api('/api/health');
  assert(health.ok === true, '健康检查');

  const lists = await api('/api/lists');
  assert(lists.items.length >= 4, `预置清单 ${lists.items.length} 个`);
  assert(lists.items.some((l) => l.id === 'baby'), '含宝宝用品清单');

  const list = await api('/api/lists', 'POST', {
    name: '冒烟测试清单', icon: '🧪', description: '测试用',
  });
  assert(!!list.id, '创建清单');

  const item = await api('/api/items', 'POST', {
    listId: list.id, name: '测试条目', qty: '2 件', category: '日用',
    assignee: '我', note: '临时', restock: true,
  });
  assert(!!item.id && item.done === 0 && item.restock === 1, '新增条目');

  const patched = await api('/api/items/' + item.id, 'PATCH', { done: true });
  assert(patched.done === 1, '勾选完成');

  const filtered = await api('/api/items?listId=' + list.id);
  assert(filtered.items.some((i) => i.id === item.id), '按清单筛选条目');

  const sum = await api('/api/summary');
  assert(sum.lists >= 5 && sum.total >= 1, `汇总统计 ${JSON.stringify(sum)}`);

  await api('/api/items/' + item.id, 'DELETE');
  await api('/api/lists/' + list.id, 'DELETE');
  assert(true, '清理测试数据');

  console.log('=== 全部通过 ===');
})().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
