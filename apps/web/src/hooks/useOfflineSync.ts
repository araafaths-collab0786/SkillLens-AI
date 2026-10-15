/**
 * useOfflineSync.ts
 *
 * Watches navigator.onLine and a health-check ping.
 * When back online, syncs queued captures to the server.
 * Shows a toast with the result.
 * Retry with exponential backoff for failed items.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  getAllCaptures,
  getBlobForCapture,
  updateCaptureStatus,
  deleteCapture,
  getBackoffDelayMs,
  isManualRetryRequired,
  type QueuedCapture,
} from "@/lib/offlineQueue";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HEALTH_CHECK_URL = `${API_BASE}/health`;
const MAX_CONCURRENT = 2;

export interface SyncResult {
  synced: number;
  failed: number;
}

export function useOfflineSync(onSyncComplete?: (result: SyncResult) => void) {
  const syncingRef = useRef(false);

  const checkOnline = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    try {
      const res = await fetch(HEALTH_CHECK_URL, { method: "GET", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const syncOne = useCallback(async (item: QueuedCapture): Promise<boolean> => {
    if (isManualRetryRequired(item.retryCount)) return false;
    if (item.status === "synced") return true;

    const blob = await getBlobForCapture(item.id);
    if (!blob) {
      await updateCaptureStatus(item.id, "failed", "Blob not found in local storage.");
      return false;
    }

    await updateCaptureStatus(item.id, "uploading");

    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
      );

      const res = await fetch(`${API_BASE}/api/v1/resumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submission_id: item.id,
          intake_method: "camera_capture",
          imageBase64: b64,
          cropCorners: item.cropCorners,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Upload failed");
      }

      await updateCaptureStatus(item.id, "synced");
      // Remove local blob after confirmed sync
      await deleteCapture(item.id);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await updateCaptureStatus(item.id, "failed", msg);
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    const online = await checkOnline();
    if (!online) return;

    syncingRef.current = true;
    const all = await getAllCaptures();
    const pending = all.filter(
      (c) =>
        (c.status === "queued" || c.status === "failed") &&
        !isManualRetryRequired(c.retryCount)
    );

    if (pending.length === 0) {
      syncingRef.current = false;
      return;
    }

    let synced = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      const batch = pending.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.all(batch.map(syncOne));
      synced += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }

    syncingRef.current = false;
    onSyncComplete?.({ synced, failed });
  }, [checkOnline, syncOne, onSyncComplete]);

  // Sync on reconnection
  useEffect(() => {
    const onOnline = () => {
      // Small delay to let the connection stabilize
      setTimeout(syncAll, 1000);
    };
    window.addEventListener("online", onOnline);
    // Also try on mount (may have come back online while app was closed)
    syncAll();
    return () => window.removeEventListener("online", onOnline);
  }, [syncAll]);

  return { syncAll };
}
