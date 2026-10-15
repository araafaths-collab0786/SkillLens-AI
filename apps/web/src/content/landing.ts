/**
 * SkillLens AI — Landing page copy
 * All text lives here so it can be changed without touching component files.
 */

export const landing = {
  meta: {
    title: "SkillLens AI — Resume–Job Skill Matching",
    description:
      "Turn your skills into proof. Close the gap to your next job. SDG 8 aligned skill matching, gap analysis, and learning path recommendations.",
  },

  nav: {
    logo: "SkillLens AI",
    links: [
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "SDG 8 Impact", href: "#sdg8" },
    ],
    cta: "Get Started",
  },

  hero: {
    headline: "Turn your skills into proof.",
    subheadline: "Close the gap to your next job.",
    body: "SkillLens AI analyzes your resume, maps your skills to a global taxonomy, and shows exactly what stands between you and your target role — with a prioritized learning path to close the gap.",
    cta: "Get Started — It's Free",
    secondaryCta: "See How It Works",
    previewLabel: "Illustrative example",
  },

  features: [
    {
      icon: "FileText",
      title: "Resume Parsing",
      body: "Upload a PDF or image. We extract your skills, projects, and certifications automatically.",
    },
    {
      icon: "ShieldCheck",
      title: "Evidence-Based Skills",
      body: "Skills are weighted by evidence — Verified, Demonstrated, or Claimed. The UI explains what each level means.",
    },
    {
      icon: "Camera",
      title: "Camera Document Capture",
      body: "No scanner? Use your phone camera. OpenCV detects, corrects, and enhances the page automatically.",
    },
    {
      icon: "BarChart2",
      title: "Skill Gap Analysis",
      body: "See exactly which required skills you're missing or under-evidenced, sorted by priority.",
    },
    {
      icon: "BookOpen",
      title: "Learning Path Recommendations",
      body: "Each gap comes with a ranked learning step: course, project, or certification — with effort estimate.",
    },
    {
      icon: "LayoutDashboard",
      title: "Job Match Dashboard",
      body: "Track your Readiness Index across roles. See how it grows as you complete learning steps.",
    },
  ],

  howItWorks: [
    {
      step: 1,
      title: "Upload or Scan",
      body: "Upload your PDF resume or scan a printed copy with your camera.",
    },
    {
      step: 2,
      title: "Screen & Extract",
      body: "We check document quality, extract text, and map your skills to the ESCO taxonomy.",
    },
    {
      step: 3,
      title: "Match & Measure",
      body: "Select a target job. Your Readiness Index shows how your evidenced skills compare.",
    },
    {
      step: 4,
      title: "Learn & Grow",
      body: "Follow your prioritized learning path. The projected readiness shows your estimated improvement.",
    },
  ],

  sdg8: {
    heading: "Supporting SDG 8 — Decent Work and Economic Growth",
    body: "Millions of job seekers — first-generation graduates, rural youth, and career switchers — are overlooked not because they lack ability, but because their skills are invisible to hiring systems. SkillLens AI makes skills explicit, comparable, and actionable.",
    targets: [
      { code: "8.5", label: "Full and productive employment" },
      { code: "8.6", label: "Youth employment and training" },
      { code: "8.8", label: "Skills-based hiring access" },
      { code: "8.b", label: "Employment strategy support" },
    ],
    link: {
      href: "https://sdgs.un.org/goals/goal8",
      label: "Learn about SDG 8 targets →",
    },
  },

  footer: {
    credit: "Built for the AICTE IBM SkillsBuild ML & Applied AI Internship Program 2026.",
    sdg: "Aligned with UN Sustainable Development Goal 8.",
  },
} as const;
