import { useState, type FormEvent } from "react";
import type { Category, Task } from "../domain/models";

export function CategoriesPage({ categories, tasks, onCreate, onUpdate, onDelete }: { categories: Category[]; tasks: Task[]; onCreate: (name: string) => Promise<void>; onUpdate: (id: string, name: string) => Promise<void>; onDelete: (category: Category) => void }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  async function create(event: FormEvent) { event.preventDefault(); try { await onCreate(name); setName(""); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "创建失败"); } }
  async function save() { if (!editingId) return; try { await onUpdate(editingId, editingName); setEditingId(null); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } }
  return <>
    <header className="page-header"><div><p className="eyebrow">组织方式</p><h1>科目与分类</h1><p>用稳定的分类看清时间和任务都投入到了哪里。</p></div></header>
    <section className="category-create"><div><h2>新建分类</h2><p>例如：英语、数据结构、毕业论文</p></div><form onSubmit={create}><input aria-label="分类名称" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="输入分类名称" /><button className="button primary">添加分类</button></form></section>
    {error && <p className="alert error" role="alert">{error}</p>}
    <div className="category-list">{categories.map((category) => { const count = tasks.filter((task) => task.categoryId === category.id).length; return <article className="category-row" key={category.id}><span className="category-dot" /><div className="category-name">{editingId === category.id ? <input aria-label="编辑分类名称" autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} /> : <><h3>{category.name}</h3><p>{count} 个有效任务</p></>}</div><div className="category-actions">{editingId === category.id ? <><button onClick={() => void save()}>保存</button><button onClick={() => setEditingId(null)}>取消</button></> : <><button onClick={() => { setEditingId(category.id); setEditingName(category.name); }}>重命名</button><button className="danger-text" onClick={() => onDelete(category)}>删除</button></>}</div></article>; })}</div>
  </>;
}
