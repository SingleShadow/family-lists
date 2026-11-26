/**
 * 家庭清单 · SQLite 存储层
 * Node 22 内置 node:sqlite，零第三方依赖。
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'family-lists.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📋',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL,
    qty TEXT DEFAULT '',
    category TEXT DEFAULT '',
    assignee TEXT DEFAULT '',
    note TEXT DEFAULT '',
    restock INTEGER DEFAULT 0,
    done INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_items_list ON items(list_id, position);
`);

const PRESETS = [
  { id: 'household', name: '家庭物资', icon: '🏠', description: '粮油日用、家里库存', sort_order: 1 },
  { id: 'shopping', name: '购物清单', icon: '🛒', description: '要买的东西，买完勾选', sort_order: 2 },
  { id: 'baby', name: '宝宝用品', icon: '🍼', description: '尿不湿、奶粉、辅食', sort_order: 3 },
  { id: 'chores', name: '家庭待办', icon: '✅', description: '缴费、预约、家务分工', sort_order: 4 },
];

const seedList = db.prepare(`
  INSERT OR IGNORE INTO lists (id, name, icon, description, sort_order)
  VALUES (@id, @name, @icon, @description, @sort_order)
`);
for (const p of PRESETS) seedList.run(p);

function now() { return new Date().toISOString(); }

function listRows() {
  return db.prepare('SELECT * FROM lists ORDER BY sort_order, created_at').all();
}

function getList(id) {
  return db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
}

function createList(b) {
  const row = {
    id: b.id || randomUUID(),
    name: String(b.name || '').trim(),
    icon: String(b.icon || '📋').trim(),
    description: String(b.description || '').trim(),
    sort_order: Number(b.sortOrder) || 99,
  };
  if (!row.name) throw new Error('清单名称不能为空');
  db.prepare(`INSERT INTO lists (id, name, icon, description, sort_order)
              VALUES (@id, @name, @icon, @description, @sort_order)`).run(row);
  return getList(row.id);
}

function updateList(id, b) {
  const cur = getList(id);
  if (!cur) return null;
  const row = {
    id,
    name: b.name !== undefined ? String(b.name).trim() : cur.name,
    icon: b.icon !== undefined ? String(b.icon).trim() : cur.icon,
    description: b.description !== undefined ? String(b.description).trim() : cur.description,
    sort_order: b.sortOrder !== undefined ? Number(b.sortOrder) : cur.sort_order,
    updated_at: now(),
  };
  if (!row.name) throw new Error('清单名称不能为空');
  db.prepare(`UPDATE lists SET name=@name, icon=@icon, description=@description,
              sort_order=@sort_order, updated_at=@updated_at WHERE id=@id`).run(row);
  return getList(id);
}

function deleteList(id) {
  db.prepare('DELETE FROM items WHERE list_id = ?').run(id);
  return db.prepare('DELETE FROM lists WHERE id = ?').run(id).changes > 0;
}

function itemRows(listId) {
  if (listId) {
    return db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY done, position, created_at').all(listId);
  }
  return db.prepare('SELECT * FROM items ORDER BY done, position, created_at').all();
}

function getItem(id) {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

function createItem(b) {
  const list = getList(b.listId);
  if (!list) throw new Error(`清单 '${b.listId}' 不存在`);
  const name = String(b.name || '').trim();
  if (!name) throw new Error('条目名称不能为空');
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM items WHERE list_id = ?').get(b.listId).m;
  const row = {
    id: b.id || randomUUID(),
    list_id: b.listId,
    name,
    qty: String(b.qty || '').trim(),
    category: String(b.category || '').trim(),
    assignee: String(b.assignee || '').trim(),
    note: String(b.note || '').trim(),
    restock: b.restock ? 1 : 0,
    done: b.done ? 1 : 0,
    position: Number.isInteger(b.position) ? b.position : maxPos + 1,
  };
  db.prepare(`INSERT INTO items (id, list_id, name, qty, category, assignee, note, restock, done, position)
              VALUES (@id, @list_id, @name, @qty, @category, @assignee, @note, @restock, @done, @position)`).run(row);
  return getItem(row.id);
}

function updateItem(id, b) {
  const cur = getItem(id);
  if (!cur) return null;
  const row = {
    id,
    name: b.name !== undefined ? String(b.name).trim() : cur.name,
    qty: b.qty !== undefined ? String(b.qty).trim() : cur.qty,
    category: b.category !== undefined ? String(b.category).trim() : cur.category,
    assignee: b.assignee !== undefined ? String(b.assignee).trim() : cur.assignee,
    note: b.note !== undefined ? String(b.note).trim() : cur.note,
    restock: b.restock !== undefined ? (b.restock ? 1 : 0) : cur.restock,
    done: b.done !== undefined ? (b.done ? 1 : 0) : cur.done,
    updated_at: now(),
  };
  if (!row.name) throw new Error('条目名称不能为空');
  db.prepare(`UPDATE items SET name=@name, qty=@qty, category=@category, assignee=@assignee,
              note=@note, restock=@restock, done=@done, updated_at=@updated_at WHERE id=@id`).run(row);
  return getItem(id);
}

function deleteItem(id) {
  return db.prepare('DELETE FROM items WHERE id = ?').run(id).changes > 0;
}

function summary() {
  const items = itemRows();
  return {
    lists: listRows().length,
    total: items.length,
    pending: items.filter((i) => !i.done).length,
    restock: items.filter((i) => !i.done && i.restock).length,
    done: items.filter((i) => i.done).length,
  };
}

module.exports = {
  listRows, getList, createList, updateList, deleteList,
  itemRows, getItem, createItem, updateItem, deleteItem,
  summary,
};
