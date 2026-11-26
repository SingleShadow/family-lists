export interface FamilyList {
  id: string;
  name: string;
  icon: string;
  description: string;
  sort_order: number;
  itemCount: number;
}

export interface Item {
  id: string;
  list_id: string;
  name: string;
  qty: string;
  category: string;
  assignee: string;
  note: string;
  restock: number;
  done: number;
  position: number;
}

export interface Summary {
  lists: number;
  total: number;
  pending: number;
  restock: number;
  done: number;
}

export interface ItemInput {
  listId: string;
  name: string;
  qty?: string;
  category?: string;
  assignee?: string;
  note?: string;
  restock?: boolean;
  done?: boolean;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error((data as { error?: string }).error || `请求失败 ${res.status}`);
  return data as T;
}

export const api = {
  health: () => req<{ ok: boolean }>('/health'),
  lists: () => req<{ items: FamilyList[] }>('/lists'),
  createList: (b: Partial<FamilyList>) => req<FamilyList>('/lists', { method: 'POST', body: JSON.stringify(b) }),
  updateList: (id: string, b: Partial<FamilyList>) => req<FamilyList>(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteList: (id: string) => req<{ ok: boolean }>(`/lists/${id}`, { method: 'DELETE' }),
  items: (listId?: string) => req<{ items: Item[] }>(`/items${listId ? `?listId=${encodeURIComponent(listId)}` : ''}`),
  createItem: (b: ItemInput) => req<Item>('/items', { method: 'POST', body: JSON.stringify(b) }),
  updateItem: (id: string, b: Partial<Item>) => req<Item>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteItem: (id: string) => req<{ ok: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  summary: () => req<Summary>('/summary'),
};
