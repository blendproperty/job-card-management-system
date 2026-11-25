import { Platform } from "react-native";

let database: Promise<IDBDatabase> | undefined;
let account: string | null = null;

export function useOfflineAccount(id: string | null) {
  account = id;
}

export const offlineAccount = () => account;

function openStore() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("blend-field", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function access<T>(key: string, write?: { value: T }): Promise<T | undefined> {
  if (Platform.OS !== "web" || !account || typeof indexedDB === "undefined") return undefined;
  const scoped = account + ":" + key;
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("records", write ? "readwrite" : "readonly");
    const store = transaction.objectStore("records");
    const request = write ? store.put(write.value, scoped) : store.get(scoped);
    transaction.oncomplete = () => resolve(write ? undefined : request.result as T | undefined);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const readOffline = <T>(key: string) => access<T>(key);
export const writeOffline = <T>(key: string, value: T) => access(key, { value });
