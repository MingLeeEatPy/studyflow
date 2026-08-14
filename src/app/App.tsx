import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { BookOpen, CalendarCheck, Database, LayoutGrid, Tags } from "lucide-react";
import type { Category, CreateTaskInput, Task } from "../domain/models";
import { studyFlowApi } from "../features/api";
import { TodayPage } from "../pages/TodayPage";
import { PlanPage } from "../pages/PlanPage";
import { CategoriesPage } from "../pages/CategoriesPage";
import { TaskForm } from "../components/TaskForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { backupSchema } from "../../shared/schemas/backup";

type Page = "today" | "plan" | "categories";
type DeleteTarget = { type: "task"; item: Task } | { type: "category"; item: Category };

function downloadJson(data: unknown, prefix = "studyflow-backup") {
  const date = new Date();
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${prefix}-${local}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [page, setPage] = useState<Page>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [nextTasks, nextCategories] = await Promise.all([studyFlowApi.tasks.list(), studyFlowApi.categories.list()]);
    setTasks(nextTasks); setCategories(nextCategories);
  }, []);
  useEffect(() => { refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "读取本地数据失败")).finally(() => setLoading(false)); }, [refresh]);
  async function saveTask(input: CreateTaskInput) { if (editingTask) await studyFlowApi.tasks.update(editingTask.id, input); else await studyFlowApi.tasks.create(input); await refresh(); }
  async function toggle(task: Task) { try { await studyFlowApi.tasks.toggleComplete(task.id); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "更新失败"); } }
  async function confirmDelete() { if (!deleteTarget) return; setDeleting(true); try { if (deleteTarget.type === "task") await studyFlowApi.tasks.archive(deleteTarget.item.id); else await studyFlowApi.categories.archive(deleteTarget.item.id); setDeleteTarget(null); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); setDeleteTarget(null); } finally { setDeleting(false); } }
  async function exportData(prefix?: string) { try { downloadJson(await studyFlowApi.backup.exportData(), prefix); setNotice("备份已导出"); } catch (reason) { setError(reason instanceof Error ? reason.message : "导出失败"); } }
  async function selectImport(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { const parsed: unknown = JSON.parse(await file.text()); setPendingImport(backupSchema.parse(parsed)); setBackupOpen(false); setError(""); } catch { setError("无效的备份文件：格式或版本不受支持"); } }
  async function confirmImport() { if (!pendingImport) return; try { downloadJson(await studyFlowApi.backup.exportData(), "studyflow-safety-backup"); await studyFlowApi.backup.replaceAll(pendingImport); setPendingImport(null); setBackupOpen(false); await refresh(); setNotice("导入成功，当前数据已被备份内容覆盖"); } catch (reason) { setError(reason instanceof Error ? reason.message : "导入失败，当前数据未改变"); } }

  if (loading) return <div className="loading-screen"><BookOpen /><p>正在打开 StudyFlow…</p></div>;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span><BookOpen /></span><div><strong>StudyFlow</strong><small>学习计划助手</small></div></div><nav aria-label="主导航">
      <a href="#today" className={page === "today" ? "active" : ""} onClick={(e) => { e.preventDefault(); setPage("today"); }}><CalendarCheck />Today</a>
      <a href="#plan" className={page === "plan" ? "active" : ""} onClick={(e) => { e.preventDefault(); setPage("plan"); }}><LayoutGrid />Plan</a>
      <a href="#categories" className={page === "categories" ? "active" : ""} onClick={(e) => { e.preventDefault(); setPage("categories"); }}><Tags />Categories</a>
    </nav><button className="data-button" onClick={() => setBackupOpen(true)}><Database />数据管理</button><div className="sidebar-note"><strong>数据仅保存在本机</strong><span>建议定期导出备份，避免浏览器数据被清理后丢失。</span></div></aside>
    <main className="main-content">{error && <div className="alert error" role="alert"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}{notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {page === "today" && <TodayPage tasks={tasks} categories={categories} onToggle={toggle} onEdit={setEditingTask} onDelete={(item) => setDeleteTarget({ type: "task", item })} onNew={() => setEditingTask(null)} />}
      {page === "plan" && <PlanPage tasks={tasks} categories={categories} onToggle={toggle} onEdit={setEditingTask} onDelete={(item) => setDeleteTarget({ type: "task", item })} onNew={() => setEditingTask(null)} />}
      {page === "categories" && <CategoriesPage tasks={tasks} categories={categories} onCreate={async (name) => { await studyFlowApi.categories.create({ name }); await refresh(); }} onUpdate={async (id, name) => { await studyFlowApi.categories.update(id, { name }); await refresh(); }} onDelete={(item) => setDeleteTarget({ type: "category", item })} />}
    </main>
    {editingTask !== undefined && <TaskForm categories={categories} task={editingTask ?? undefined} onSubmit={saveTask} onClose={() => setEditingTask(undefined)} />}
    {deleteTarget && <ConfirmDialog title={deleteTarget.type === "task" ? "删除任务" : "删除分类"} message={deleteTarget.type === "task" ? `“${deleteTarget.item.title}”将从计划中移除，但历史记录仍会保留。` : `确定删除分类“${deleteTarget.item.name}”吗？正在使用的分类不能删除。`} busy={deleting} onConfirm={() => void confirmDelete()} onClose={() => setDeleteTarget(null)} />}
    {backupOpen && <Modal title="数据管理" onClose={() => setBackupOpen(false)}><div className="backup-panel"><section><h3>导出完整备份</h3><p>将任务、分类和历史事件保存为 JSON 文件。</p><button className="button secondary" onClick={() => void exportData()}>导出全部数据</button></section><section><h3>覆盖导入</h3><p>导入会替换当前数据。确认导入时，会先自动下载当前数据的安全备份。</p><input ref={fileRef} hidden type="file" accept="application/json,.json" aria-label="导入备份文件" onChange={(e) => void selectImport(e)} /><button className="button secondary" onClick={() => fileRef.current?.click()}>选择备份文件</button></section></div></Modal>}
    {pendingImport !== null && <Modal title="覆盖导入" onClose={() => setPendingImport(null)}><p className="confirm-copy">备份中的内容将替换当前全部数据。StudyFlow 会先自动下载当前数据的安全备份。</p><footer className="modal-actions"><button className="button secondary" onClick={() => setPendingImport(null)}>取消</button><button className="button danger" onClick={() => void confirmImport()}>确认覆盖导入</button></footer></Modal>}
  </div>;
}
