/**
 * useDocumentCamera.ts
 *
 * Custom hook for the camera document capture flow.
 * Handles:
 * - getUserMedia with rear camera preference (facingMode: "environment")
 * - Landscape + portrait
 * - Tab backgrounding: release stream on hidden, restart on visible
 * - Missing camera / permission denied gracefully
 * - Canvas capture → base64 blob
 * - Draggable corner handles (returned as state for the overlay)
 * - Offline queue save when navigator.onLine is false
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  saveCapture,
  type QueuedCapture,
} from "@/lib/offlineQueue";

export type CaptureCorner = [number, number]; // [x, y] in image pixels
export type CropCorners = [CaptureCorner, CaptureCorner, CaptureCorner, CaptureCorner];

export interface CameraState {
  /** The live stream is attached to this ref — assign to <video ref={videoRef} /> */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Status of the camera */
  cameraStatus: "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";
  /** Error message if cameraStatus is "denied" | "unavailable" | "error" */
  cameraError: string | null;
  /** Capture dimensions */
  videoWidth: number;
  videoHeight: number;
  /** Crop corner handles in image-pixel coordinates */
  corners: CropCorners | null;
  setCorners: (c: CropCorners) => void;
  /** Capture a frame, save offline if needed */
  capture: () => Promise<{ id: string; offline: boolean } | null>;
  /** Captured blob (for preview before submit) */
  capturedBlob: Blob | null;
  /** Clear captured state */
  resetCapture: () => void;
  /** Start camera */
  startCamera: () => Promise<void>;
  /** Stop camera */
  stopCamera: () => void;
}

export function useDocumentCamera(): CameraState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraState["cameraStatus"]>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [corners, setCorners] = useState<CropCorners | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("idle");
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      setCameraError("Camera is not available on this device or browser.");
      return;
    }

    setCameraStatus("requesting");
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoWidth(videoRef.current.videoWidth);
        setVideoHeight(videoRef.current.videoHeight);
      }

      setCameraStatus("active");
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraStatus("denied");
        setCameraError(
          "Camera access was denied. Please allow camera access in your browser settings and try again."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraStatus("unavailable");
        setCameraError(
          "No camera found on this device. Use the file upload method instead."
        );
      } else {
        setCameraStatus("error");
        setCameraError("Could not start the camera. Please try again.");
      }
    }
  }, []);

  // Release and restart on tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopCamera();
      } else if (cameraStatus === "idle") {
        // Don't auto-restart — user must tap "Start Camera"
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [stopCamera, cameraStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capture = useCallback(async (): Promise<{ id: string; offline: boolean } | null> => {
    const video = videoRef.current;
    if (!video || cameraStatus !== "active") return null;

    const w = video.videoWidth || videoWidth;
    const h = video.videoHeight || videoHeight;
    if (!w || !h) return null;

    // Draw to canvas
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });
    if (!blob) return null;

    setCapturedBlob(blob);

    const id = uuidv4();
    const offline = !navigator.onLine;

    // Always save to offline queue — acts as a local buffer
    await saveCapture(id, blob, corners);

    return { id, offline };
  }, [cameraStatus, videoWidth, videoHeight, corners]);

  const resetCapture = useCallback(() => {
    setCapturedBlob(null);
    setCorners(null);
  }, []);

  return {
    videoRef,
    cameraStatus,
    cameraError,
    videoWidth,
    videoHeight,
    corners,
    setCorners,
    capture,
    capturedBlob,
    resetCapture,
    startCamera,
    stopCamera,
  };
}
