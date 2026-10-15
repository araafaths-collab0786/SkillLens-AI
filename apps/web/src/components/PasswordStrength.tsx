/**
 * Password strength meter component.
 * Scores 0–4 based on length and character variety.
 */
"use client";

type Strength = 0 | 1 | 2 | 3 | 4;

function score(password: string): Strength {
  if (!password) return 0;
  let s = 0;
  if (password.length >= 12) s++;
  if (password.length >= 16) s++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
  if (/\d/.test(password)) s++;
  if (/[^A-Za-z0-9]/.test(password)) s++;
  return Math.min(s, 4) as Strength;
}

const LABELS: Record<Strength, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

const COLORS: Record<Strength, string> = {
  0: "bg-gray-200",
  1: "bg-red-400",
  2: "bg-orange-400",
  3: "bg-yellow-400",
  4: "bg-green-500",
};

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const s = score(password);
  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1" aria-live="polite" aria-atomic="true">
      <div className="flex gap-1" aria-hidden="true">
        {([1, 2, 3, 4] as Strength[]).map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              s >= level ? COLORS[s] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      {s > 0 && (
        <p className="text-xs text-gray-500">
          Password strength:{" "}
          <span
            className={s >= 3 ? "text-green-600 font-medium" : "text-orange-600 font-medium"}
          >
            {LABELS[s]}
          </span>
        </p>
      )}
    </div>
  );
}
