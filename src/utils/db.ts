import { Project } from '../types/animation';

const DB_NAME = 'DuetAnimationDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    const projectStore = tx.objectStore(PROJECTS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    const updatedProject = {
      ...project,
      updatedAt: Date.now(),
    };

    projectStore.put(updatedProject);
    metaStore.put({ key: 'lastActiveProjectId', value: project.id });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load project from IndexedDB:', err);
    return null;
  }
}

export async function loadLastActiveProjectId(): Promise<string | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const request = store.get('lastActiveProjectId');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}

export async function listAllProjects(): Promise<Array<{ id: string; name: string; updatedAt: number; frameCount: number }>> {
  try {
    const db = await getDB();
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const projects: Project[] = request.result || [];
        const meta = projects.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
          frameCount: p.frames.length,
        }));
        meta.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(meta);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    tx.objectStore(PROJECTS_STORE).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete project:', err);
  }
}
