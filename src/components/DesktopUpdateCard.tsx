import { useEffect, useState } from "react";
import { desktopUpdater, type DesktopUpdateState } from "../desktop/desktopUpdater";

export function DesktopUpdateCard() {
  const [state, setState] = useState<DesktopUpdateState>({ status: "idle" });
  const check = () => {
    setState({ status: "checking" });
    void desktopUpdater.check().then(setState);
  };

  useEffect(() => { check(); }, []);

  if (state.status === "unsupported") return null;
  const busy = state.status === "checking" || state.status === "downloading";
  return <section className="desktop-update-card" aria-label="桌面版更新">
    <div>
      <h2>Windows 桌面版更新</h2>
      {state.status === "available" && <p>发现 StudyFlow {state.version}。{state.notes ?? "下载后将自动安装并重新打开应用。"}</p>}
      {state.status === "up-to-date" && <p>当前已是最新版本。</p>}
      {state.status === "checking" && <p>正在检查更新…</p>}
      {state.status === "downloading" && <p>正在下载更新{state.percent === null ? "…" : `：${state.percent}%`}</p>}
      {state.status === "failed" && <p className="inline-warning">{state.message}</p>}
      {state.status === "idle" && <p>桌面版会在打开时检查更新。</p>}
    </div>
    {state.status === "available"
      ? <button className="button primary" type="button" onClick={() => void desktopUpdater.install(setState)}>下载并重启</button>
      : <button className="button secondary" type="button" disabled={busy} onClick={check}>{busy ? "请稍候…" : "检查桌面版更新"}</button>}
  </section>;
}
