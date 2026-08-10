import { Project } from '../types/animation';
import {
  saveProjectToSupabase,
  loadProjectFromSupabase,
  listSupabaseProjects,
  deleteProjectFromSupabase,
} from '../lib/supabase';

const DB_NAME = 'DuetAnimationDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
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
  const updatedProject = {
    ...project,
    updatedAt: Date.now(),
  };

  try {
    const db = await getDB();
    const tx = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    const projectStore = tx.objectStore(PROJECTS_STORE);
    const metaStore = tx.objectStore(META_STORE);

    projectStore.put(updatedProject);
    metaStore.put({ key: 'lastActiveProjectId', value: project.id });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
  }

  // Background Cloud Sync to Supabase
  saveProjectToSupabase(updatedProject).catch(() => {});
}

export async function loadProject(id: string): Promise<Project | null> {
  let localProject: Project | null = null;
  try {
    const db = await getDB();
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.get(id);

    localProject = await new Promise<Project | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load project from IndexedDB:', err);
  }

  if (localProject) return localProject;

  // Fallback to load from Supabase Cloud Backend
  const cloudProject = await loadProjectFromSupabase(id);
  if (cloudProject) {
    // Cache in local IndexedDB
    try {
      const db = await getDB();
      const tx = db.transaction(PROJECTS_STORE, 'readwrite');
      tx.objectStore(PROJECTS_STORE).put(cloudProject);
    } catch (e) {}
  }
  return cloudProject;
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
  let localProjects: Array<{ id: string; name: string; updatedAt: number; frameCount: number }> = [];

  try {
    const db = await getDB();
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const request = store.getAll();

    localProjects = await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const projects: Project[] = request.result || [];
        const meta = projects.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
          frameCount: p.frames.length,
        }));
        resolve(meta);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    localProjects = [];
  }

  // Fetch Supabase Cloud Projects and merge
  try {
    const supabaseList = await listSupabaseProjects();
    const map = new Map<string, { id: string; name: string; updatedAt: number; frameCount: number }>();

    localProjects.forEach((p) => map.set(p.id, p));
    supabaseList.forEach((p) => {
      if (!map.has(p.id) || p.updatedAt > (map.get(p.id)?.updatedAt || 0)) {
        map.set(p.id, p);
      }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    return merged;
  } catch (e) {
    localProjects.sort((a, b) => b.updatedAt - a.updatedAt);
    return localProjects;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    tx.objectStore(PROJECTS_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete project locally:', err);
  }

  deleteProjectFromSupabase(id).catch(() => {});
}

