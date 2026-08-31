export type DeviceReminderRecord = {
  id: string;
  intervalId: string;
  revision: number;
  dueAt: string;
  state: "scheduled" | "cancelled";
};

const DATABASE = "StudyFlowRuntime";
const STORE = "reminders";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本设备提醒存储"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let value: T;
    operation(store, (next) => { value = next; }, reject);
    transaction.oncomplete = () => { database.close(); resolve(value); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("本设备提醒存储失败")); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("本设备提醒存储已取消")); };
  });
}

export function reminderRecordId(intervalId: string, revision: number): string {
  return `${intervalId}:${revision}`;
}

export function putDeviceReminder(record: DeviceReminderRecord): Promise<void> {
  return withStore("readwrite", (store, done, fail) => {
    const request = store.put(record);
    request.onsuccess = () => done(undefined);
    request.onerror = () => fail(request.error);
  });
}

export function getDeviceReminder(id: string): Promise<DeviceReminderRecord | undefined> {
  return withStore("readonly", (store, done, fail) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result as DeviceReminderRecord | undefined);
    request.onerror = () => fail(request.error);
  });
}

export function listDeviceReminders(): Promise<DeviceReminderRecord[]> {
  return withStore("readonly", (store, done, fail) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result as DeviceReminderRecord[]);
    request.onerror = () => fail(request.error);
  });
}

export async function cancelDeviceReminders(exceptId?: string): Promise<void> {
  const records = await listDeviceReminders();
  await Promise.all(records.filter((record) => record.id !== exceptId && record.state !== "cancelled").map((record) => putDeviceReminder({ ...record, state: "cancelled" })));
}

export function clearDeviceReminders(): Promise<void> {
  return withStore("readwrite", (store, done, fail) => {
    const request = store.clear();
    request.onsuccess = () => done(undefined);
    request.onerror = () => fail(request.error);
  });
}
