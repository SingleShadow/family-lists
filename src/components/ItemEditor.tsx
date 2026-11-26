import { useState } from 'react';
import { api, type FamilyList, type Item } from '../api/client';

const SUGGESTED_CATEGORIES = ['食品', '日用', '宝宝', '清洁', '药品', '衣物', '其他'];

interface Props {
  item?: Item;
  defaultListId?: string;
  lists: FamilyList[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ItemEditor({ item, defaultListId, lists, onClose, onSaved }: Props) {
  const [listId, setListId] = useState(item?.list_id || defaultListId || lists[0]?.id || '');
  const [name, setName] = useState(item?.name || '');
  const [qty, setQty] = useState(item?.qty || '');
  const [category, setCategory] = useState(item?.category || '');
  const [assignee, setAssignee] = useState(item?.assignee || '');
  const [note, setNote] = useState(item?.note || '');
  const [restock, setRestock] = useState(!!item?.restock);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) { setError('请填写名称'); return; }
    setSaving(true);
    try {
      const payload = { listId, name: name.trim(), qty, category, assignee, note, restock };
      if (item) await api.updateItem(item.id, { restock: restock ? 1 : 0, qty, category, assignee, note, name: name.trim() });
      else await api.createItem(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{item ? '编辑条目' : '添加条目'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="form">
          <label>所属清单
            <select value={listId} onChange={(e) => setListId(e.target.value)} disabled={!!item}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
          </label>
          <label>名称 <span className="required">*</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：尿不湿 L 码" />
          </label>
          <div className="form-row">
            <label>数量
              <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="例如：2 包" />
            </label>
            <label>分类
              <input list="category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：宝宝" />
              <datalist id="category-options">
                {SUGGESTED_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
          </div>
          <label>负责人
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="例如：妈妈 / 我" />
          </label>
          <label>备注
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="放在哪、品牌、注意事项…" />
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            <span>标记为待补货（在列表中高亮提醒）</span>
          </label>
          {error && <div className="error-banner">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="ghost-btn" onClick={onClose}>取消</button>
          <button className="primary-btn" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}
