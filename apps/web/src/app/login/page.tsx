/**
 * SkillLens AI — Login Page (/login)
 *
 * - Sign In / Sign Up toggle with sliding indicator.
 * - Zod + React Hook Form validation with fade-in field errors.
 * - Password strength meter on Sign Up.
 * - ?next= redirect with allowlist validation (mirrors middleware.ts).
 * - Logged-in users redirect to /dashboard.
 * - "Back to home" link.
 * - Full-width card on phones, max-width centered on larger screens.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PasswordStrength } from "@/components/PasswordStrength";
import { cn } from "@/lib/cn";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
type SignInForm = z.infer<typeof signInSchema>;

const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password must not exceed 128 characters"),
    confirmPassword: z.string(),
    role: z.enum(["job_seeker", "recruiter", "career_counselor"], {
      required_error: "Select a role",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type SignUpForm = z.infer<typeof signUpSchema>;

// ── ?next= allowlist (mirrors middleware.ts) ──────────────────────────────────

const ALLOWED_NEXT = new Set(["/dashboard", "/resume", "/match", "/gap-analysis"]);

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("//") || /^https?:\/\//i.test(decoded)) return "/dashboard";
  } catch {
    return "/dashboard";
  }
  const pathOnly = raw.split("?")[0].split("#")[0];
  return ALLOWED_NEXT.has(pathOnly) ? pathOnly : "/dashboard";
}

// ── Field error ────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          key="error"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="mt-1 text-xs text-red-600"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// ── Input wrapper ─────────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-deep-navy mb-1">
      {children}
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("signin");
  const [serverError, setServerError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const nextPath = safeNext(searchParams.get("next"));

  // Sign In form
  const signIn = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  // Sign Up form
  const signUp = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "job_seeker",
    },
  });

  const watchPassword = signUp.watch("password");

  // Reset server error when switching tabs
  useEffect(() => {
    setServerError("");
    signIn.reset();
    signUp.reset();
    setShowPassword(false);
    setShowConfirm(false);
  }, [tab]);

  // Sign In submit
  const onSignIn = signIn.handleSubmit(async (data) => {
    setServerError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            remember_me: data.rememberMe ?? false,
          }),
        }
      );
      const json = await res.json();
      if (json.error) {
        setServerError(json.error.message ?? "Sign in failed. Please try again.");
        return;
      }
      router.push(nextPath);
    } catch {
      setServerError("Network error. Please try again.");
    }
  });

  // Sign Up submit
  const onSignUp = signUp.handleSubmit(async (data) => {
    setServerError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            full_name: data.fullName,
            email: data.email,
            password: data.password,
            confirm_password: data.confirmPassword,
            role: data.role,
          }),
        }
      );
      const json = await res.json();
      if (json.error) {
        setServerError(json.error.message ?? "Registration failed. Please try again.");
        return;
      }
      router.push(nextPath);
    } catch {
      setServerError("Network error. Please try again.");
    }
  });

  const inputCls = (hasError: boolean) =>
    cn(
      "w-full rounded-lg border bg-white px-3 py-2.5 text-base text-deep-navy",
      "placeholder:text-gray-400 outline-none transition-colors duration-200",
      "focus:ring-2 focus:ring-cyan-text/50 focus:border-cyan-text",
      hasError ? "border-red-400" : "border-gray-300 hover:border-gray-400"
    );

  return (
    <div className="min-h-screen bg-white-mist flex flex-col">
      {/* Back to home */}
      <div className="px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-cyan-text hover:underline focus-visible:outline-deep-navy"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to home
        </Link>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
          {/* Logo */}
          <div className="mb-6 text-center">
            <Link
              href="/"
              className="text-xl font-bold text-deep-navy focus-visible:outline-cyan-text"
            >
              SkillLens AI
            </Link>
          </div>

          {/* Tab toggle */}
          <div
            className="relative flex rounded-lg bg-gray-100 p-1 mb-6"
            role="tablist"
            aria-label="Authentication mode"
          >
            {/* Sliding indicator */}
            <motion.div
              className="absolute inset-y-1 rounded-md bg-white shadow-sm"
              animate={{ left: tab === "signin" ? "4px" : "50%", width: "calc(50% - 4px)" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              aria-hidden="true"
            />
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative flex-1 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus-visible:outline-deep-navy",
                  tab === t ? "text-deep-navy" : "text-gray-500 hover:text-deep-navy"
                )}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Server error */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                key="server-err"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Sign In form ──────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {tab === "signin" && (
              <motion.form
                key="signin"
                role="tabpanel"
                aria-label="Sign in form"
                onSubmit={onSignIn}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
                noValidate
              >
                <div>
                  <Label htmlFor="signin-email">Email address</Label>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputCls(!!signIn.formState.errors.email)}
                    {...signIn.register("email")}
                  />
                  <FieldError message={signIn.formState.errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      className={cn(inputCls(!!signIn.formState.errors.password), "pr-10")}
                      {...signIn.register("password")}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-deep-navy"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <FieldError message={signIn.formState.errors.password?.message} />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="signin-remember"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-cyan focus:ring-cyan-text"
                    {...signIn.register("rememberMe")}
                  />
                  <label htmlFor="signin-remember" className="text-sm text-gray-600">
                    Remember me
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={signIn.formState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan py-3 text-base font-semibold text-deep-navy hover:brightness-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-deep-navy disabled:opacity-60"
                >
                  {signIn.formState.isSubmitting && (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  )}
                  Sign In
                </button>
              </motion.form>
            )}

            {/* ── Sign Up form ──────────────────────────────────────────────── */}
            {tab === "signup" && (
              <motion.form
                key="signup"
                role="tabpanel"
                aria-label="Sign up form"
                onSubmit={onSignUp}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
                noValidate
              >
                <div>
                  <Label htmlFor="signup-name">Full name</Label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    className={inputCls(!!signUp.formState.errors.fullName)}
                    {...signUp.register("fullName")}
                  />
                  <FieldError message={signUp.formState.errors.fullName?.message} />
                </div>

                <div>
                  <Label htmlFor="signup-email">Email address</Label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputCls(!!signUp.formState.errors.email)}
                    {...signUp.register("email")}
                  />
                  <FieldError message={signUp.formState.errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                      className={cn(inputCls(!!signUp.formState.errors.password), "pr-10")}
                      {...signUp.register("password")}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-deep-navy"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordStrength password={watchPassword} />
                  <FieldError message={signUp.formState.errors.password?.message} />
                </div>

                <div>
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <div className="relative">
                    <input
                      id="signup-confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      className={cn(inputCls(!!signUp.formState.errors.confirmPassword), "pr-10")}
                      {...signUp.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-deep-navy"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <FieldError message={signUp.formState.errors.confirmPassword?.message} />
                </div>

                <div>
                  <Label htmlFor="signup-role">I am a</Label>
                  <select
                    id="signup-role"
                    className={inputCls(!!signUp.formState.errors.role)}
                    {...signUp.register("role")}
                  >
                    <option value="job_seeker">Job Seeker</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="career_counselor">Career Counselor</option>
                  </select>
                  <FieldError message={signUp.formState.errors.role?.message} />
                </div>

                <button
                  type="submit"
                  disabled={signUp.formState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan py-3 text-base font-semibold text-deep-navy hover:brightness-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-deep-navy disabled:opacity-60"
                >
                  {signUp.formState.isSubmitting && (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  )}
                  Create Account
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
