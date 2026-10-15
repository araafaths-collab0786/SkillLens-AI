/**
 * Toast notification system — SkillLens AI
 *
 * Provides:
 *   - ToastProvider  — renders the toast container (add once to layout)
 *   - useToast       — hook to show/dismiss toasts
 *   - toast()        — imperative helper that works outside React
 *
 * Toast types: "success" | "error" | "warning" | "info"
 * Auto-dismisses after 4 seconds (reduced motion: 6 seconds).
 * Respects prefers-reduced-motion (no slide animation).
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 4000
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ToastContextValue {
  show: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Icon map ─────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />,
  error:   <XCircle     className="h-4 w-4 shrink-0 text-red-600"   aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />,
  info:    <Info        className="h-4 w-4 shrink-0 text-cyan-text"  aria-hidden="true" />,
};

const STYLES: Record<ToastType, string> = {
  success: "bg-white border-green-200",
  error:   "bg-white border-red-200",
  warning: "bg-white border-amber-200",
  info:    "bg-white border-cyan/30",
};

// ── Individual toast ──────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const shouldReduce = useReducedMotion();
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      layout
      initial={shouldReduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "flex items-start gap-3 rounded-xl border shadow-md px-4 py-3",
        "min-w-[260px] max-w-sm w-full",
        STYLES[toast.type]
      )}
    >
      {ICONS[toast.type]}
      <p className="flex-1 text-sm text-deep-navy leading-snug">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-text"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((t: Omit<Toast, "id">): string => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose imperatively for use outside React
  useEffect(() => {
    _setGlobalToast(show);
    return () => _setGlobalToast(null);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {/* Toast container — bottom-right on desktop, bottom-center on phones */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 flex flex-col gap-2 items-center sm:items-end"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Imperative helper (for use outside React components) ──────────────────────

type ShowFn = ((t: Omit<Toast, "id">) => string) | null;
let _globalShow: ShowFn = null;

function _setGlobalToast(fn: ShowFn) {
  _globalShow = fn;
}

export const toast = {
  show: (t: Omit<Toast, "id">) => _globalShow?.(t) ?? "",
  success: (message: string) => _globalShow?.({ type: "success", message }) ?? "",
  error:   (message: string) => _globalShow?.({ type: "error",   message }) ?? "",
  warning: (message: string) => _globalShow?.({ type: "warning", message }) ?? "",
  info:    (message: string) => _globalShow?.({ type: "info",    message }) ?? "",
};
