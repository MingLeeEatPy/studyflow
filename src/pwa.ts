import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdate {
  apply(): Promise<void>;
}

export function registerPwa(onNeedRefresh: (update: PwaUpdate) => void): void {
  if (!import.meta.env.PROD) return;
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      onNeedRefresh({ apply: () => updateServiceWorker(true) });
    },
  });
}
