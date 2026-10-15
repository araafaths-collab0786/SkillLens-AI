/**
 * SkillLens AI — Offline capture queue (IndexedDB via idb)
 *
 * Stores camera captures locally when offline.
 * Item states: captured → queued → uploading → synced
 *              captured → queued → failed (retryable) → uploading → synced
 *
 * Exponential backoff: 5s, 15s, 45s (max 5 retries), then manual.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "skilllens-offline";
const DB_VERSION = 1;
const STORE_CAPTURES = "captures";
const STORE_BLOBS = "blobs";

export type CaptureStatus =
  | "captured"
  | "queued"
  | "uploading"
  | "synced"
  | "failed";

export interface QueuedCapture {
  id: string;           // client UUID — idempotency key
  status: CaptureStatus;
  cropCorners: [[number, number], [number, number], [number, number], [number, number]] | null;
  capturedAt: string;   // ISO datetime
  retryCount: number;
  lastError?: string;
  blobKey: string;      // key into the blobs store
}

// ── DB setup ──────────────────────────────────────────────────────────────────

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
        db.createObjectStore(STORE_CAPTURES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    },
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function saveCapture(
  id: string,
  blob: Blob,
  cropCorners: QueuedCapture["cropCorners"]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_CAPTURES, STORE_BLOBS], "readwrite");
  await tx.objectStore(STORE_BLOBS).put(blob, id);
  await tx.objectStore(STORE_CAPTURES).put({
    id,
    status: "captured" as CaptureStatus,
    cropCorners,
    capturedAt: new Date().toISOString(),
    retryCount: 0,
    blobKey: id,
  });
  await tx.done;
}

export async function getCapture(id: string): Promise<QueuedCapture | undefined> {
  const db = await getDB();
  return db.get(STORE_CAPTURES, id);
}

export async function getAllCaptures(): Promise<QueuedCapture[]> {
  const db = await getDB();
  return db.getAll(STORE_CAPTURES);
}

export async function updateCaptureStatus(
  id: string,
  status: CaptureStatus,
  lastError?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get(STORE_CAPTURES, id);
  if (!item) return;
  const updated: QueuedCapture = {
    ...item,
    status,
    lastError,
    retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
  };
  await db.put(STORE_CAPTURES, updated);
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_CAPTURES, STORE_BLOBS], "readwrite");
  await tx.objectStore(STORE_CAPTURES).delete(id);
  await tx.objectStore(STORE_BLOBS).delete(id);
  await tx.done;
}

export async function getBlobForCapture(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(STORE_BLOBS, id);
}

// ── Backoff ───────────────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
const MAX_RETRIES = 5;

export function getBackoffDelayMs(retryCount: number): number {
  const idx = Math.min(retryCount, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[idx];
}

export function isManualRetryRequired(retryCount: number): boolean {
  return retryCount >= MAX_RETRIES;
}
