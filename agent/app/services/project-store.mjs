import { assertSnapshotHasNoSecret } from "../domain/project-snapshot.mjs";

const DATABASE = "mattrace-projects";
const STORE = "workspace";
const RECORD_KEY = "current";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("IndexedDB 操作失败"));
  });
}

function openDatabase() {
  if (typeof indexedDB === "undefined") throw new Error("当前浏览器不支持项目保存");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开项目存储"));
  });
}

export function createIndexedDbAdapter() {
  async function withStore(mode, operation) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE, mode);
      return await operation(transaction.objectStore(STORE));
    } finally {
      database.close();
    }
  }
  return {
    put(value) {
      return withStore("readwrite", (store) => requestResult(store.put(value, RECORD_KEY)));
    },
    get() {
      return withStore("readonly", (store) => requestResult(store.get(RECORD_KEY)));
    },
    delete() {
      return withStore("readwrite", (store) => requestResult(store.delete(RECORD_KEY)));
    },
  };
}

export function createProjectStore(adapter = createIndexedDbAdapter()) {
  return {
    async saveProject(snapshot) {
      assertSnapshotHasNoSecret(snapshot);
      if (snapshot.version !== 1) throw new Error("不支持的项目快照版本");
      await adapter.put(snapshot);
    },
    async loadProject() {
      const snapshot = await adapter.get();
      if (!snapshot || snapshot.version !== 1) return null;
      assertSnapshotHasNoSecret(snapshot);
      return snapshot;
    },
    async deleteProject() {
      await adapter.delete();
    },
  };
}
