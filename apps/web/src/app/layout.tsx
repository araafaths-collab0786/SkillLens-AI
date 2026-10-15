import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: {
    default: "SkillLens AI — Resume–Job Skill Matching",
    template: "%s | SkillLens AI",
  },
  description:
    "Turn your skills into proof. Close the gap to your next job. SDG 8 aligned skill matching and gap analysis platform.",
  openGraph: {
    title: "SkillLens AI",
    description:
      "Turn your skills into proof. Close the gap to your next job.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white-mist text-deep-navy font-sans antialiased">
        {/* Skip-to-content link for keyboard and screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
                     focus:px-4 focus:py-2 focus:bg-cyan focus:text-deep-navy focus:rounded-lg
                     focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ToastProvider>
          <main id="main-content">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
