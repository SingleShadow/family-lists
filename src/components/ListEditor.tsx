import { useState } from 'react';
import { api, type FamilyList } from '../api/client';

const ICONS = ['🏠', '🛒', '🍼', '✅', '📦', '💊', '🧹', '📚', '🎂', '🐱'];

interface Props {
  list?: FamilyList;
  onClose: () => void;
  onSaved: (id?: string) => void;
}

export default function ListEditor({ list, onClose, onSaved }: Props) {
  const [name, setName] = useState(list?.name || '');
  const [icon, setIcon] = useState(list?.icon || '📋');
  const [description, setDescription] = useState(list?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) { setError('请填写清单名称'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), icon, description };
      const saved = list
        ? await api.updateList(list.id, payload)
        : await api.createList(payload);
      onSaved(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{list ? '编辑清单' : '新建清单'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="form">
          <label>名称 <span className="required">*</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：药箱清单" />
          </label>
          <div className="label-text">图标</div>
          <div className="icon-grid">
            {ICONS.map((i) => (
              <button key={i} className={`icon-choice ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)}>{i}</button>
            ))}
          </div>
          <label>说明
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话描述这个清单" />
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
