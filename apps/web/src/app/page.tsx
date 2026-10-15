/**
 * SkillLens AI — Landing Page (/)
 *
 * Public, no login fields.
 * Sections: Hero, Features, How It Works, SDG 8 Impact, Footer.
 * Copy lives in /content/landing.ts.
 * Responsive: 1-col phones → 2-col tablets → 3-col features desktop.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Camera,
  BarChart2,
  BookOpen,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ScorePreview } from "@/components/ScorePreview";
import { landing } from "@/content/landing";

export const metadata: Metadata = {
  title: landing.meta.title,
  description: landing.meta.description,
  openGraph: {
    title: "SkillLens AI",
    description: landing.meta.description,
    type: "website",
  },
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  ShieldCheck,
  Camera,
  BarChart2,
  BookOpen,
  LayoutDashboard,
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white-mist text-deep-navy">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28 lg:px-8"
      >
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="font-bold text-deep-navy leading-tight">
              {landing.hero.headline}
              <br />
              <span className="text-cyan-text">{landing.hero.subheadline}</span>
            </h1>
            <p className="mt-6 max-w-xl mx-auto lg:mx-0 text-base text-gray-600 leading-relaxed">
              {landing.hero.body}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-cyan px-6 py-3 text-base font-semibold text-deep-navy hover:brightness-95 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-deep-navy shadow-sm"
              >
                {landing.hero.cta}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-deep-navy hover:bg-gray-50 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-deep-navy"
              >
                {landing.hero.secondaryCta}
              </a>
            </div>
          </div>

          {/* Animated preview card */}
          <div className="w-full max-w-sm lg:max-w-xs shrink-0">
            <ScorePreview />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="bg-white border-t border-gray-100 py-16 sm:py-20"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="features-heading" className="font-bold text-deep-navy">
              Everything you need to bridge the gap
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              From camera capture to calibrated skill matching — SkillLens AI
              gives every candidate a fair chance.
            </p>
          </div>

          {/* 1 col → 2 col → 3 col */}
          <ul
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {landing.features.map((feature, i) => {
              const Icon = ICON_MAP[feature.icon] ?? FileText;
              return (
                <li
                  key={feature.title}
                  className="rounded-xl border border-gray-200 bg-white-mist p-6 transition-shadow duration-200 hover:shadow-md"
                  style={{
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-cyan/10">
                    <Icon size={22} className="text-cyan" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold text-deep-navy mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-16 sm:py-20"
        aria-labelledby="hiw-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="hiw-heading" className="font-bold text-deep-navy">
              How It Works
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl mx-auto">
              From resume to learning path in four steps.
            </p>
          </div>

          {/* Vertical on phones, horizontal on md+ */}
          <ol
            className="flex flex-col gap-8 md:flex-row md:gap-0 md:items-start"
            role="list"
          >
            {landing.howItWorks.map((step, idx) => (
              <li
                key={step.step}
                className="flex flex-row items-start gap-4 md:flex-col md:items-center md:text-center md:flex-1"
              >
                {/* Step number + connector */}
                <div className="flex flex-col items-center md:flex-row md:w-full">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan text-deep-navy font-bold text-sm">
                    {step.step}
                  </div>
                  {/* Connector line between steps on md+ */}
                  {idx < landing.howItWorks.length - 1 && (
                    <div
                      className="hidden md:block flex-1 h-0.5 bg-gradient-to-r from-cyan to-cyan/20 mx-2"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {/* Content */}
                <div className="md:mt-4 md:px-2">
                  <h3 className="text-sm font-semibold text-deep-navy">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── SDG 8 Impact ─────────────────────────────────────────────────── */}
      <section
        id="sdg8"
        className="bg-deep-navy py-16 sm:py-20"
        aria-labelledby="sdg8-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2
              id="sdg8-heading"
              className="font-bold text-white leading-tight"
            >
              {landing.sdg8.heading}
            </h2>
            <p className="mt-6 text-gray-300 leading-relaxed">
              {landing.sdg8.body}
            </p>

            {/* Targets */}
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" role="list">
              {landing.sdg8.targets.map((t) => (
                <li
                  key={t.code}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center"
                >
                  <span className="block text-lg font-bold text-cyan">
                    {t.code}
                  </span>
                  <span className="block text-xs text-gray-300 mt-1 leading-snug">
                    {t.label}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href={landing.sdg8.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-cyan hover:underline focus-visible:outline-cyan"
            >
              {landing.sdg8.link.label}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white-mist py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-1">
          <p className="text-sm text-gray-500">{landing.footer.credit}</p>
          <p className="text-xs text-gray-400">{landing.footer.sdg}</p>
        </div>
      </footer>
    </div>
  );
}
