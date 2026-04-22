import { openDB, type IDBPDatabase } from "idb";
import type { Project } from "@/types";

const DB_NAME = "ba-visual-planner";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";
const IMAGE_STORE = "images";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = (await db.getAll(PROJECT_STORE)) as Project[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  return (await db.get(PROJECT_STORE, id)) as Project | undefined;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put(PROJECT_STORE, project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const project = (await db.get(PROJECT_STORE, id)) as Project | undefined;
  await db.delete(PROJECT_STORE, id);
  if (project?.beforeImageId) await deleteImage(project.beforeImageId);
  if (project?.afterImageId) await deleteImage(project.afterImageId);
}

export async function saveImage(id: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(IMAGE_STORE, blob, id);
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  return (await db.get(IMAGE_STORE, id)) as Blob | undefined;
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(IMAGE_STORE, id);
}

export async function getImageUrl(id?: string): Promise<string | undefined> {
  if (!id) return undefined;
  const blob = await getImage(id);
  if (!blob) return undefined;
  return URL.createObjectURL(blob);
}

// Duplicate a project including its image blobs.
export async function duplicateProject(id: string): Promise<Project | undefined> {
  const original = await getProject(id);
  if (!original) return undefined;

  const newId = crypto.randomUUID();
  let newBeforeId: string | undefined;
  let newAfterId: string | undefined;

  if (original.beforeImageId) {
    const blob = await getImage(original.beforeImageId);
    if (blob) {
      newBeforeId = crypto.randomUUID();
      await saveImage(newBeforeId, blob);
    }
  }
  if (original.afterImageId) {
    const blob = await getImage(original.afterImageId);
    if (blob) {
      newAfterId = crypto.randomUUID();
      await saveImage(newAfterId, blob);
    }
  }

  const copy: Project = {
    ...original,
    id: newId,
    name: `${original.name} (copy)`,
    beforeImageId: newBeforeId,
    afterImageId: newAfterId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    annotations: original.annotations.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    })),
  };
  await saveProject(copy);
  return copy;
}

// JSON export / import (with images encoded as base64)
export async function exportProjectJson(id: string): Promise<string> {
  const project = await getProject(id);
  if (!project) throw new Error("Project not found");

  const encode = async (imgId?: string) => {
    if (!imgId) return undefined;
    const blob = await getImage(imgId);
    if (!blob) return undefined;
    const buf = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { type: blob.type, data: btoa(binary) };
  };

  const payload = {
    schema: "ba-planner@1",
    project,
    images: {
      before: await encode(project.beforeImageId),
      after: await encode(project.afterImageId),
    },
  };
  return JSON.stringify(payload, null, 2);
}

export async function importProjectJson(json: string): Promise<Project> {
  const payload = JSON.parse(json);
  if (payload.schema !== "ba-planner@1") throw new Error("Unsupported file format");
  const project: Project = payload.project;

  const decode = (entry?: { type: string; data: string }) => {
    if (!entry) return undefined;
    const binary = atob(entry.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: entry.type });
  };

  const newId = crypto.randomUUID();
  let beforeId: string | undefined;
  let afterId: string | undefined;
  const beforeBlob = decode(payload.images?.before);
  const afterBlob = decode(payload.images?.after);
  if (beforeBlob) {
    beforeId = crypto.randomUUID();
    await saveImage(beforeId, beforeBlob);
  }
  if (afterBlob) {
    afterId = crypto.randomUUID();
    await saveImage(afterId, afterBlob);
  }

  const imported: Project = {
    ...project,
    id: newId,
    beforeImageId: beforeId,
    afterImageId: afterId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveProject(imported);
  return imported;
}
