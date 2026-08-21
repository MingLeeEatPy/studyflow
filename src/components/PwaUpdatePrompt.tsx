import { useEffect, useState } from 'react';
import type { PwaUpdate } from '../pwa';

export function PwaUpdatePrompt() {
  const [update, setUpdate] = useState<PwaUpdate | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setUpdate((event as CustomEvent<PwaUpdate>).detail);
    window.addEventListener('studyflow:pwa-update', receive);
    return () => window.removeEventListener('studyflow:pwa-update', receive);
  }, []);
  if (!update) return null;
  return <div className="pwa-update" role="status"><span>StudyFlow 已有新版本；当前专注不会被自动中断。</span><button className="button secondary" onClick={() => setUpdate(null)}>稍后</button><button className="button primary" onClick={() => void update.apply()}>刷新更新</button></div>;
}
