/**
 * SkillLens AI — API Envelope Types
 *
 * Every API response from the backend is wrapped in this envelope:
 *   { data, error, meta }
 */

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;   // ISO 8601
  version: string;     // API version, e.g. "1.0.0"
  uncalibrated?: boolean;  // true when any score in `data` depends on uncalibrated semantic matching
}
