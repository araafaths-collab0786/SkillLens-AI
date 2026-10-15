/**
 * CropOverlay.tsx
 *
 * Renders draggable corner handles over a camera viewfinder.
 * Corner handles are 44×44 px touch targets (WCAG 2.5.5).
 * Works with both mouse and touch events.
 */
"use client";

import { useCallback, useRef } from "react";
import type { CropCorners, CaptureCorner } from "@/hooks/useDocumentCamera";

interface CropOverlayProps {
  corners: CropCorners;
  onChange: (corners: CropCorners) => void;
  containerWidth: number;
  containerHeight: number;
  /** Image natural size — for coordinate mapping */
  imageWidth: number;
  imageHeight: number;
}

const HANDLE_SIZE = 44;

export function CropOverlay({
  corners,
  onChange,
  containerWidth,
  containerHeight,
  imageWidth,
  imageHeight,
}: CropOverlayProps) {
  const draggingIdx = useRef<number | null>(null);

  const toDisplay = (pt: CaptureCorner): [number, number] => [
    (pt[0] / imageWidth) * containerWidth,
    (pt[1] / imageHeight) * containerHeight,
  ];

  const toImage = (x: number, y: number): CaptureCorner => [
    Math.round((x / containerWidth) * imageWidth),
    Math.round((y / containerHeight) * imageHeight),
  ];

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const rect = (e.currentTarget as SVGElement).closest("div")!.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return [touch.clientX - rect.left, touch.clientY - rect.top];
    }
    return [(e as React.MouseEvent).clientX - rect.left, (e as React.MouseEvent).clientY - rect.top];
  };

  const onMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (draggingIdx.current === null) return;
      const [x, y] = getEventPos(e);
      const newCorners = [...corners] as CropCorners;
      newCorners[draggingIdx.current] = toImage(
        Math.max(0, Math.min(x, containerWidth)),
        Math.max(0, Math.min(y, containerHeight))
      );
      onChange(newCorners);
    },
    [corners, onChange, containerWidth, containerHeight, imageWidth, imageHeight]
  );

  const onUp = useCallback(() => {
    draggingIdx.current = null;
  }, []);

  const displayCorners = corners.map(toDisplay);

  // Draw the quadrilateral outline
  const points = displayCorners.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div
      className="absolute inset-0 select-none"
      onMouseMove={onMove}
      onMouseUp={onUp}
      onTouchMove={(e) => { e.preventDefault(); onMove(e); }}
      onTouchEnd={onUp}
      style={{ touchAction: "none" }}
    >
      <svg
        width={containerWidth}
        height={containerHeight}
        className="absolute inset-0"
        aria-hidden="true"
      >
        <polygon
          points={points}
          fill="rgba(6, 182, 212, 0.1)"
          stroke="#06B6D4"
          strokeWidth="2"
          strokeDasharray="8 4"
        />
      </svg>

      {displayCorners.map(([cx, cy], idx) => (
        <button
          key={idx}
          type="button"
          aria-label={`Drag corner ${idx + 1} to adjust document crop`}
          className="absolute rounded-full border-2 border-cyan bg-white shadow-md cursor-grab active:cursor-grabbing focus-visible:outline-deep-navy"
          style={{
            left: cx - HANDLE_SIZE / 2,
            top: cy - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            touchAction: "none",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            draggingIdx.current = idx;
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            draggingIdx.current = idx;
          }}
        >
          <span className="sr-only">Corner handle {idx + 1}</span>
        </button>
      ))}
    </div>
  );
}
