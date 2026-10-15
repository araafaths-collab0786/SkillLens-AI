/**
 * SkillLens AI — Resume Intake Page (/resume)
 *
 * Two intake methods:
 *   Method A: Upload PDF / Image
 *   Method B: Scan Hardcopy with Camera (OpenCV)
 *
 * Both feed the same server-side pipeline and produce the same report.
 * Offline camera captures are saved to IndexedDB and synced on reconnection.
 * Responsive: tabs full-width on phones, segmented on desktop.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, CheckCircle, AlertTriangle, XCircle, Loader2, Wifi, WifiOff } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDocumentCamera, type CropCorners } from "@/hooks/useDocumentCamera";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { CropOverlay } from "@/components/CropOverlay";
import { cn } from "@/lib/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "upload" | "camera";
type UploadStage = "idle" | "checking" | "screening" | "extracting" | "parsing" | "done" | "error";

interface ScreeningStepResult {
  step: string;
  status: "passed" | "warning" | "failed";
  flags: string[];
  metrics: Record<string, unknown>;
}

interface ParsedSkill {
  id: string;
  rawText: string;
  evidenceLevel: number;
  sourceSection: string;
  sourceSnippet?: string;
  escoMapping: { label: string; matchType: string; uncalibrated: boolean } | null;
}

interface ResumeResult {
  id: string;
  status: string;
  screeningReport: ScreeningStepResult[];
  skills: ParsedSkill[];
  disclaimer: string;
}

// ── Stage labels ──────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "",
  checking: "Checking file…",
  screening: "Screening document…",
  extracting: "Extracting text…",
  parsing: "Parsing skills…",
  done: "Complete",
  error: "Error",
};

// ── Upload Progress ───────────────────────────────────────────────────────────

function UploadProgress({ stage }: { stage: UploadStage }) {
  const stages: UploadStage[] = ["checking", "screening", "extracting", "parsing"];
  if (stage === "idle") return null;
  return (
    <div className="mt-4 space-y-2" aria-live="polite" aria-label="Upload progress">
      {stages.map((s, i) => {
        const stageIdx = stages.indexOf(stage);
        const isDone = stage === "done" || i < stageIdx;
        const isActive = i === stageIdx && stage !== "done" && stage !== "error";
        return (
          <div key={s} className="flex items-center gap-3 text-sm">
            <div
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                isDone ? "bg-green-100" : isActive ? "bg-cyan/20" : "bg-gray-100"
              )}
            >
              {isDone ? (
                <CheckCircle size={12} className="text-green-600" />
              ) : isActive ? (
                <Loader2 size={12} className="text-cyan animate-spin" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-gray-300" />
              )}
            </div>
            <span className={isDone ? "text-gray-500" : isActive ? "text-deep-navy font-medium" : "text-gray-400"}>
              {STAGE_LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Screening Report ──────────────────────────────────────────────────────────

function ScreeningReport({ report, disclaimer }: { report: ScreeningStepResult[]; disclaimer: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 italic border-l-2 border-gray-300 pl-3">{disclaimer}</p>
      {report.map((step) => (
        <div
          key={step.step}
          className={cn(
            "rounded-lg border p-4",
            step.status === "passed" ? "border-green-200 bg-green-50" :
            step.status === "warning" ? "border-yellow-200 bg-yellow-50" :
            "border-red-200 bg-red-50"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            {step.status === "passed" && <CheckCircle size={14} className="text-green-600 shrink-0" />}
            {step.status === "warning" && <AlertTriangle size={14} className="text-yellow-600 shrink-0" />}
            {step.status === "failed" && <XCircle size={14} className="text-red-600 shrink-0" />}
            <span className="text-sm font-medium text-deep-navy capitalize">
              {step.step.replace(/_/g, " ")}
            </span>
            <span className={cn(
              "ml-auto text-xs font-medium px-2 py-0.5 rounded-full",
              step.status === "passed" ? "bg-green-100 text-green-700" :
              step.status === "warning" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            )}>
              {step.status}
            </span>
          </div>
          {step.flags.map((flag, i) => (
            <p key={i} className="text-xs text-gray-600 mt-1 ml-6">{flag}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Evidence level labels ─────────────────────────────────────────────────────

const EVIDENCE_LABELS: Record<number, string> = {
  3: "Verified",
  2: "Demonstrated",
  1: "Claimed",
  0: "Absent",
};
const EVIDENCE_COLORS: Record<number, string> = {
  3: "bg-green-100 text-green-700",
  2: "bg-blue-100 text-blue-700",
  1: "bg-yellow-100 text-yellow-700",
  0: "bg-gray-100 text-gray-500",
};

// ── Parsed Skills ─────────────────────────────────────────────────────────────

function ParsedSkillsList({ skills }: { skills: ParsedSkill[] }) {
  if (!skills.length) {
    return (
      <p className="text-sm text-gray-500 italic">
        No skills extracted yet. Skill extraction is added in Phase 4.
      </p>
    );
  }
  return (
    <ul className="space-y-3" role="list">
      {skills.map((skill) => (
        <li key={skill.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-medium text-deep-navy text-sm">{skill.rawText}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", EVIDENCE_COLORS[skill.evidenceLevel])}>
              {EVIDENCE_LABELS[skill.evidenceLevel]}
            </span>
            {skill.escoMapping?.uncalibrated && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                Uncalibrated similarity match
              </span>
            )}
          </div>
          {skill.escoMapping && (
            <p className="text-xs text-gray-500">
              ESCO: <span className="font-medium">{skill.escoMapping.label}</span>
              {" "}via{" "}
              <span className="italic">{skill.escoMapping.matchType}</span>
            </p>
          )}
          {skill.sourceSnippet && (
            <p className="text-xs text-gray-400 mt-1 italic">"{skill.sourceSnippet}"</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Method A: File upload ─────────────────────────────────────────────────────

function UploadMethod({ onResult }: { onResult: (r: ResumeResult) => void }) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    // Client-side type check
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF, PNG, and JPEG files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum allowed size is 10 MB.");
      return;
    }

    setStage("checking");
    const submissionId = uuidv4();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("submission_id", submissionId);

    try {
      setStage("screening");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/resumes`,
        { method: "POST", body: formData, credentials: "include" }
      );
      setStage("extracting");
      const json = await res.json();
      setStage("parsing");

      if (json.error) {
        setStage("error");
        setError(json.error.message ?? "Upload failed.");
        return;
      }

      setStage("done");
      onResult(json.data);
    } catch {
      setStage("error");
      setError("Network error. Please try again.");
    }
  }, [onResult]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-cyan transition-colors duration-200 cursor-pointer"
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF, PNG, or JPEG file"
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        <Upload size={32} className="mx-auto mb-3 text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-deep-navy">
          Drag and drop, or <span className="text-cyan-text underline">browse</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">PDF, PNG, JPEG · Max 10 MB · Max 5 pages</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          aria-label="File upload input"
        />
      </div>

      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-600 flex items-center gap-2"
        >
          <XCircle size={14} aria-hidden="true" />
          {error}
        </motion.p>
      )}

      <UploadProgress stage={stage} />
    </div>
  );
}

// ── Method B: Camera capture ──────────────────────────────────────────────────

function CameraMethod({ onResult }: { onResult: (r: ResumeResult) => void }) {
  const {
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
  } = useDocumentCamera();

  const [isOnline] = useState(() => navigator.onLine);
  const [uploading, setUploading] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!viewfinderRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDisplaySize({ w: width, h: height });
    });
    obs.observe(viewfinderRef.current);
    return () => obs.disconnect();
  }, []);

  const handleCapture = async () => {
    const result = await capture();
    if (!result) return;

    if (result.offline) {
      setOfflineSaved(true);
      return;
    }

    // Online — upload immediately
    await uploadCapture(result.id);
  };

  const uploadCapture = async (captureId: string) => {
    if (!capturedBlob) return;
    setUploading(true);
    setUploadError("");

    try {
      const buffer = await capturedBlob.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buffer).reduce((acc, b) => acc + String.fromCharCode(b), "")
      );

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/resumes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            submission_id: captureId,
            intake_method: "camera_capture",
            imageBase64: b64,
            cropCorners: corners,
          }),
        }
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      onResult(json.data);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Set default corners once video dimensions are known
  useEffect(() => {
    if (videoWidth && videoHeight && !corners) {
      const margin = 20;
      setCorners([
        [margin, margin],
        [videoWidth - margin, margin],
        [videoWidth - margin, videoHeight - margin],
        [margin, videoHeight - margin],
      ]);
    }
  }, [videoWidth, videoHeight, corners, setCorners]);

  return (
    <div className="space-y-4">
      {/* Online / offline indicator */}
      <div className="flex items-center gap-2 text-xs">
        {isOnline ? (
          <><Wifi size={13} className="text-green-500" /> <span className="text-gray-500">Online — captures upload immediately</span></>
        ) : (
          <><WifiOff size={13} className="text-yellow-500" /> <span className="text-yellow-700 font-medium">Offline — captures saved on this device, will sync when online</span></>
        )}
      </div>

      {/* Camera states */}
      {cameraStatus === "idle" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <Camera size={32} className="mx-auto mb-3 text-gray-400" aria-hidden="true" />
          <p className="text-sm text-gray-600 mb-4">
            Use your device camera to scan a printed resume or certificate.
            We'll detect, straighten, and enhance the page automatically.
          </p>
          <p className="text-xs text-gray-400 mb-4 italic">
            OCR and skill extraction require a server connection.
            Capturing and saving works offline.
          </p>
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-95 transition-all focus-visible:outline-deep-navy"
            aria-label="Start camera to capture document"
          >
            <Camera size={16} aria-hidden="true" />
            Start Camera
          </button>
        </div>
      )}

      {cameraStatus === "requesting" && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-8 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-cyan" aria-hidden="true" />
          <p className="text-sm text-gray-600">Requesting camera access…</p>
        </div>
      )}

      {(cameraStatus === "denied" || cameraStatus === "unavailable" || cameraStatus === "error") && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-center">
          <AlertTriangle size={24} className="mx-auto mb-3 text-yellow-600" aria-hidden="true" />
          <p className="text-sm text-yellow-800 font-medium mb-1">Camera unavailable</p>
          <p className="text-sm text-yellow-700">{cameraError}</p>
          <p className="text-xs text-yellow-600 mt-2">Please use the Upload PDF / Image method instead.</p>
        </div>
      )}

      {cameraStatus === "active" && !capturedBlob && (
        <div className="space-y-3">
          {/* Viewfinder */}
          <div
            ref={viewfinderRef}
            className="relative w-full overflow-hidden rounded-xl bg-black"
            style={{ maxHeight: "60vh", aspectRatio: "4/3" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              aria-label="Live camera viewfinder for document capture"
            />
            {/* Guide frame */}
            <div
              className="absolute inset-4 border-2 border-cyan/60 rounded-lg pointer-events-none"
              aria-hidden="true"
            />
            {/* Crop handles overlay */}
            {corners && displaySize.w > 0 && videoWidth > 0 && (
              <CropOverlay
                corners={corners}
                onChange={setCorners}
                containerWidth={displaySize.w}
                containerHeight={displaySize.h}
                imageWidth={videoWidth}
                imageHeight={videoHeight}
              />
            )}
          </div>
          <p className="text-xs text-center text-gray-500">
            Align the document within the frame. Drag corners to adjust crop.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={handleCapture}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan w-16 h-16 shadow-lg hover:brightness-95 transition-all focus-visible:outline-deep-navy"
              aria-label="Capture document photo"
            >
              <Camera size={24} className="text-deep-navy" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="self-center text-sm text-gray-500 hover:text-gray-700 focus-visible:outline-deep-navy"
              aria-label="Cancel camera"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Captured preview */}
      {capturedBlob && !offlineSaved && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img
              src={URL.createObjectURL(capturedBlob)}
              alt="Captured document preview"
              className="w-full max-h-96 object-contain bg-gray-900"
            />
          </div>
          {uploadError && (
            <p role="alert" className="text-sm text-red-600 flex items-center gap-1">
              <XCircle size={13} aria-hidden="true" /> {uploadError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetCapture}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-deep-navy hover:bg-gray-50 focus-visible:outline-deep-navy"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => { /* captureId stored in hook */ }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan py-2.5 text-sm font-semibold text-deep-navy hover:brightness-95 disabled:opacity-60 focus-visible:outline-deep-navy"
              aria-label="Submit captured document for processing"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : null}
              {uploading ? "Uploading…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {offlineSaved && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-center"
          role="status"
          aria-live="polite"
        >
          <WifiOff size={20} className="mx-auto mb-2 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800">Saved on this device.</p>
          <p className="text-xs text-yellow-700 mt-1">
            Will upload automatically when you're back online.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResumePage() {
  const [tab, setTab] = useState<Tab>("upload");
  const [result, setResult] = useState<ResumeResult | null>(null);

  // Sync queued captures when back online
  useOfflineSync(({ synced, failed }) => {
    if (synced > 0) {
      // Toast would live here — implemented in Phase 6
      console.info(`Synced ${synced} capture(s). Failed: ${failed}`);
    }
  });

  return (
    <div className="min-h-screen bg-white-mist">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-deep-navy mb-2">Upload or Scan Resume</h1>
        <p className="text-sm text-gray-600 mb-6">
          Upload a PDF or image, or scan a printed copy with your camera.
          Both methods use the same analysis pipeline.
        </p>

        {/* Method toggle — full width on phones */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6" role="tablist" aria-label="Resume intake method">
          {(["upload", "camera"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setResult(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-deep-navy",
                tab === t
                  ? "bg-white text-deep-navy shadow-sm"
                  : "text-gray-500 hover:text-deep-navy"
              )}
            >
              {t === "upload" ? <Upload size={15} aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}
              {t === "upload" ? "Upload PDF / Image" : "Scan with Camera"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "upload" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="tabpanel"
            aria-label={tab === "upload" ? "File upload panel" : "Camera capture panel"}
          >
            {tab === "upload" ? (
              <UploadMethod onResult={setResult} />
            ) : (
              <CameraMethod onResult={setResult} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-8 space-y-6"
            >
              {/* Screening report */}
              <section aria-labelledby="screening-heading">
                <h2 id="screening-heading" className="text-lg font-semibold text-deep-navy mb-4">
                  Screening Report
                </h2>
                <ScreeningReport
                  report={result.screeningReport}
                  disclaimer={result.disclaimer}
                />
              </section>

              {/* Parsed skills */}
              <section aria-labelledby="skills-heading">
                <h2 id="skills-heading" className="text-lg font-semibold text-deep-navy mb-4">
                  Extracted Skills
                </h2>
                <ParsedSkillsList skills={result.skills} />
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
