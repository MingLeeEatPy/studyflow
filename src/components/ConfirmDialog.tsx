import { Modal } from "./Modal";

export function ConfirmDialog({ title, message, confirmLabel = "确认删除", busy, onConfirm, onClose }: { title: string; message: string; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}><p className="confirm-copy">{message}</p><footer className="modal-actions"><button className="button secondary" onClick={onClose}>取消</button><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? "处理中…" : confirmLabel}</button></footer></Modal>;
}
