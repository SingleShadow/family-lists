import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type FamilyList, type Item, type Summary } from './api/client';
import ItemEditor from './components/ItemEditor';
import ListEditor from './components/ListEditor';

type Filter = 'all' | 'restock' | 'pending' | 'done';

export default function App() {
  const [lists, setLists] = useState<FamilyList[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeList, setActiveList] = useState<string>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ item?: Item; listId?: string } | null>(null);
  const [listEditor, setListEditor] = useState<FamilyList | 'new' | null>(null);
  const [showLists, setShowLists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, i, s] = await Promise.all([api.lists(), api.items(), api.summary()]);
      setLists(l.items);
      setItems(i.items);
      setSummary(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.assignee && set.add(i.assignee));
    return [...set];
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => activeList === 'all' || i.list_id === activeList)
      .filter((i) => {
        if (filter === 'restock') return !!i.restock && !i.done;
        if (filter === 'pending') return !i.done;
        if (filter === 'done') return !!i.done;
        return true;
      })
      .filter((i) => !assigneeFilter || i.assignee === assigneeFilter)
      .filter((i) => !q || [i.name, i.qty, i.category, i.assignee, i.note].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.done - b.done || a.position - b.position);
  }, [items, activeList, filter, assigneeFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    visible.forEach((i) => {
      const key = i.category || '未分类';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [visible]);

  const activeName = activeList === 'all'
    ? '全部清单'
    : lists.find((l) => l.id === activeList)?.name || '清单';

  async function toggleDone(item: Item) {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, done: i.done ? 0 : 1 } : i));
    try {
      const updated = await api.updateItem(item.id, { done: item.done ? 0 : 1 });
      setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
      setSummary(await api.summary());
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
      load();
    }
  }

  async function toggleRestock(item: Item) {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, restock: i.restock ? 0 : 1 } : i));
    try {
      const updated = await api.updateItem(item.id, { restock: item.restock ? 0 : 1 });
      setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
      setSummary(await api.summary());
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
      load();
    }
  }

  async function removeItem(item: Item) {
    if (!window.confirm(`删除「${item.name}」？`)) return;
    try {
      await api.deleteItem(item.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  }

  async function removeList(list: FamilyList) {
    if (!window.confirm(`删除清单「${list.name}」及其所有条目？`)) return;
    try {
      await api.deleteList(list.id);
      if (activeList === list.id) setActiveList('all');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setShowLists(true)} aria-label="清单列表">☰</button>
        <div className="brand">
          <span className="brand-mark">✓</span>
          <div>
            <h1>家庭清单</h1>
            <p>家里的事，一处记清楚</p>
          </div>
        </div>
        <div className="top-stats">
          <span className="stat-chip">{summary?.pending ?? 0} 待办</span>
          {(summary?.restock ?? 0) > 0 && <span className="stat-chip alert">{summary!.restock} 待补货</span>}
        </div>
      </header>

      <main className="main">
        <aside className={`sidebar ${showLists ? 'open' : ''}`}>
          <div className="sidebar-head">
            <h2>我的清单</h2>
            <button className="icon-btn" onClick={() => setShowLists(false)} aria-label="关闭">✕</button>
          </div>
          <button
            className={`list-row ${activeList === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveList('all'); setShowLists(false); }}
          >
            <span className="list-icon">🗂</span><span className="list-name">全部清单</span>
            <span className="list-count">{items.filter((i) => !i.done).length}</span>
          </button>
          {lists.map((l) => (
            <div key={l.id} className="list-item-wrap">
              <button
                className={`list-row ${activeList === l.id ? 'active' : ''}`}
                onClick={() => { setActiveList(l.id); setShowLists(false); }}
              >
                <span className="list-icon">{l.icon}</span>
                <span className="list-name">{l.name}</span>
                <span className="list-count">{l.itemCount}</span>
              </button>
              <button className="list-edit" onClick={() => setListEditor(l)} aria-label="编辑清单">⋯</button>
            </div>
          ))}
          <button className="add-list-btn" onClick={() => setListEditor('new')}>＋ 新建清单</button>
          <div className="sidebar-foot">
            <span>{summary?.done ?? 0} 项已完成</span>
          </div>
        </aside>

        <section className="content">
          <div className="content-head">
            <div>
              <h2>{activeName}</h2>
              <p className="subtitle">{visible.length} 条记录</p>
            </div>
            <button className="primary-btn" onClick={() => setEditor({ listId: activeList === 'all' ? lists[0]?.id : activeList })}>
              ＋ 添加条目
            </button>
          </div>

          <div className="toolbar">
            <div className="search-wrap">
              <span>🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索名称、分类、备注…"
              />
            </div>
            <div className="filters">
              {([['all', '全部'], ['pending', '待办'], ['restock', '待补货'], ['done', '已完成']] as [Filter, string][]).map(([k, label]) => (
                <button key={k} className={`filter-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            {assignees.length > 0 && (
              <select className="assignee-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                <option value="">所有人</option>
                {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          {loading ? (
            <div className="empty">加载中…</div>
          ) : grouped.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <p>还没有条目</p>
              <span>点右上角「添加条目」开始记录</span>
            </div>
          ) : (
            <div className="groups">
              {grouped.map(([category, group]) => (
                <div key={category} className="group">
                  <div className="group-title">{category} <span>{group.length}</span></div>
                  <div className="cards">
                    {group.map((item) => (
                      <div key={item.id} className={`card ${item.done ? 'done' : ''}`}>
                        <button
                          className={`check ${item.done ? 'checked' : ''}`}
                          onClick={() => toggleDone(item)}
                          aria-label={item.done ? '取消完成' : '标记完成'}
                        >{item.done ? '✓' : ''}</button>
                        <div className="card-body" onClick={() => setEditor({ item })}>
                          <div className="card-title">
                            {item.name}
                            {!!item.restock && !item.done && <span className="badge">待补货</span>}
                          </div>
                          <div className="card-meta">
                            {item.qty && <span>数量 {item.qty}</span>}
                            {item.assignee && <span className="person">👤 {item.assignee}</span>}
                            {item.note && <span className="note">{item.note}</span>}
                          </div>
                        </div>
                        <div className="card-actions">
                          {!item.done && (
                            <button
                              className={`mini-btn ${item.restock ? 'on' : ''}`}
                              onClick={() => toggleRestock(item)}
                              title="标记待补货"
                            >🔔</button>
                          )}
                          <button className="mini-btn" onClick={() => removeItem(item)} title="删除">🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showLists && <div className="backdrop" onClick={() => setShowLists(false)} />}

      {editor && (
        <ItemEditor
          item={editor.item}
          defaultListId={editor.listId}
          lists={lists}
          onClose={() => setEditor(null)}
          onSaved={async () => { setEditor(null); await load(); }}
        />
      )}

      {listEditor && (
        <ListEditor
          list={listEditor === 'new' ? undefined : listEditor}
          onClose={() => setListEditor(null)}
          onSaved={async (id) => {
            setListEditor(null);
            await load();
            if (id) setActiveList(id);
          }}
        />
      )}
    </div>
  );
}
